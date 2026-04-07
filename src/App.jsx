import { useState, useEffect, useMemo } from 'react'
import { supabase } from './lib/supabase'
import { SEED_COMMANDES } from './lib/seedData'
import { SEED_LIVRAISONS, ENGAGEMENTS } from './lib/livraisonsData'
import * as XLSX from 'xlsx'
import './App.css'

// ─── Export utilities ────────────────────────────────────────────────────────
function exportCSV(filename, headers, rows) {
  const escape = v => {
    if (v == null) return ''
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function exportXLSX(filename, sheetName, headers, rows) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const colWidths = headers.map((h, i) => ({
    wch: Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length), 10)
  }))
  ws['!cols'] = colWidths
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename)
}

function ExportBar({ label, onCSV, onXLSX }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
      <span style={{ fontSize:11, color:'#444', marginRight:4 }}>{label}</span>
      <button onClick={onCSV} title="Exporter en CSV" style={{
        padding:'5px 12px', borderRadius:6, fontSize:11, cursor:'pointer',
        background:'#1a2a1a', border:'1px solid #2a4a2a', color:'#2ed573', fontWeight:500
      }}>⬇ CSV</button>
      <button onClick={onXLSX} title="Exporter en Excel" style={{
        padding:'5px 12px', borderRadius:6, fontSize:11, cursor:'pointer',
        background:'#1a2a1a', border:'1px solid #2a4a2a', color:'#2ed573', fontWeight:500
      }}>⬇ XLSX</button>
    </div>
  )
}
// ─────────────────────────────────────────────────────────────────────────────

const STATUT_LIVRAISON = {
  'Proformé':              { icon:'📋', color:'#4a9eff', bg:'#0a1a2b', border:'#102840' },
  'En route':              { icon:'🚚', color:'#ff9f43', bg:'#2b1e0a', border:'#4a3010' },
  'En cours de vérification': { icon:'🔍', color:'#f9ca24', bg:'#2b2a0a', border:'#4a4010' },
  'Réceptionné':           { icon:'✅', color:'#2ed573', bg:'#0d2b1a', border:'#1a4a2a' },
  'Retard':                { icon:'⚠️', color:'#ff4757', bg:'#2b0a0a', border:'#4a1010' },
}

function Badge({ status }) {
  const s = STATUT_LIVRAISON[status] || STATUT_LIVRAISON['Proformé']
  return <span style={{ display:'inline-block', padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:500, background:s.bg, color:s.color, border:`1px solid ${s.border}`, whiteSpace:'nowrap' }}>{s.icon} {status}</span>
}

function ProgressBar({ liv, eng, cmd }) {
  const pLiv = cmd > 0 ? Math.round(liv / cmd * 100) : 0
  const pEng = cmd > 0 ? Math.min(100, Math.round((liv + eng) / cmd * 100)) : 0
  return (
    <div style={{ minWidth: 90 }}>
      <div style={{ height: 6, background: '#222', borderRadius: 3, marginBottom: 3, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${pEng}%`, background:'#ff9f4366', borderRadius:3 }} />
        <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${pLiv}%`, background:'#2ed573', borderRadius:3 }} />
      </div>
      <div style={{ fontSize:10, color:'#555' }}>
        {pLiv}% réceptionné{pEng > pLiv ? ` · ${pEng}% engagé` : ''}
      </div>
    </div>
  )
}

function groupByModel(rows, engMap) {
  const map = new Map()
  for (const r of rows) {
    const key = `${r.bc}||${r.ref}||${r.produit}`
    if (!map.has(key)) map.set(key, { bc:r.bc, ref:r.ref, fournisseur:r.fournisseur, produit:r.produit, categorie:r.categorie, livraison_prevue:r.livraison_prevue, rows:[] })
    map.get(key).rows.push(r)
  }
  return Array.from(map.values()).map(g => {
    const totalCmd = g.rows.reduce((s,r)=>s+r.qte_commandee,0)
    const totalLiv = g.rows.reduce((s,r)=>s+r.qte_livree,0)
    const totalEng = g.rows.reduce((s,r)=>{
      const k = `${r.ref}||${r.taille}`
      return s + (engMap[k] || 0)
    },0)
    return { ...g, qte_commandee:totalCmd, qte_livree:totalLiv, qte_engagee:totalEng }
  })
}

// ─── Modal saisie livraison ──────────────────────────────────────────────────
function SaisieModal({ livraison, commandes, engMap, onClose, onSave }) {
  const [search, setSearch] = useState('')
  const [lignes, setLignes] = useState({}) // { [id]: string }
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return commandes.filter(c =>
      !q ||
      c.produit?.toLowerCase().includes(q) ||
      c.ref?.toLowerCase().includes(q) ||
      c.taille?.toLowerCase().includes(q)
    )
  }, [commandes, search])

  function setQty(id, val) {
    // only allow non-negative integers
    if (val === '' || /^\d+$/.test(val)) {
      setLignes(prev => ({ ...prev, [id]: val }))
    }
  }

  const totalSaisi = Object.values(lignes).reduce((s, v) => s + (parseInt(v) || 0), 0)
  const nbLignesSaisies = Object.values(lignes).filter(v => parseInt(v) > 0).length

  async function handleSave() {
    const updates = commandes
      .filter(c => parseInt(lignes[c.id]) > 0)
      .map(c => ({ id: c.id, delta: parseInt(lignes[c.id]), newQty: c.qte_livree + parseInt(lignes[c.id]) }))

    if (updates.length === 0) {
      onClose()
      return
    }

    setSaving(true)
    setSaveError(null)
    const errors = []

    for (const u of updates) {
      const { error } = await supabase
        .from('commandes')
        .update({ qte_livree: u.newQty })
        .eq('id', u.id)
      if (error) errors.push(`ID ${u.id}: ${error.message}`)
    }

    if (errors.length > 0) {
      setSaveError(errors.join('\n'))
      setSaving(false)
      return
    }

    // Also update the livraison statut to "En cours de vérification" if still "En route"
    if (livraison.statut === 'En route') {
      await supabase
        .from('livraisons')
        .update({ statut: 'En cours de vérification' })
        .eq('id', livraison.id)
    }

    setSaving(false)
    onSave()
  }

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:1000,
      display:'flex', alignItems:'flex-start', justifyContent:'center',
      padding:'40px 20px', overflowY:'auto'
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background:'#141414', border:'1px solid #2a2a2a', borderRadius:12,
        width:'100%', maxWidth:820, display:'flex', flexDirection:'column', gap:0
      }}>
        {/* Header */}
        <div style={{ padding:'20px 24px', borderBottom:'1px solid #1e1e1e' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:16, fontWeight:600, color:'#fff' }}>
                📝 Saisir livraison — {livraison.facture}
              </div>
              <div style={{ fontSize:12, color:'#555', marginTop:4 }}>
                {livraison.entite} · {livraison.type} · {livraison.date_livraison ? new Date(livraison.date_livraison).toLocaleDateString('fr-FR') : '—'}
                {livraison.montant_ht ? ` · ${livraison.montant_ht.toLocaleString('fr-FR', {minimumFractionDigits:2})} €` : ''}
              </div>
            </div>
            <button onClick={onClose} style={{ background:'none', border:'none', color:'#555', fontSize:20, cursor:'pointer', padding:'4px 8px' }}>✕</button>
          </div>
          <div style={{ marginTop:12, padding:'10px 14px', background:'#1a1a1a', borderRadius:8, border:'1px solid #252525', fontSize:12, color:'#888', lineHeight:1.5 }}>
            ⚠️ Entrez les quantités <strong style={{color:'#ddd'}}>reçues dans cette livraison spécifique</strong>.
            Ces quantités seront <strong style={{color:'#ff9f43'}}>ajoutées</strong> au réceptionné actuel de chaque article.
            Laissez à <strong style={{color:'#ddd'}}>0</strong> les articles non livrés dans cette facture.
          </div>
        </div>

        {/* Search */}
        <div style={{ padding:'14px 24px', borderBottom:'1px solid #1a1a1a' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filtrer par article, réf., taille..."
            style={{ width:'100%', boxSizing:'border-box' }}
            autoFocus
          />
        </div>

        {/* Table */}
        <div style={{ overflowY:'auto', maxHeight:'50vh' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead style={{ position:'sticky', top:0, background:'#141414', zIndex:1 }}>
              <tr>
                {['Article', 'Taille', 'Commandé', 'Réceptionné', 'Reliquat', 'Reçu dans cette livraison'].map((h, i) => (
                  <th key={i} style={{ textAlign: i >= 2 ? 'right' : 'left', padding:'8px 12px', color:'#444', borderBottom:'1px solid #1e1e1e', fontSize:10, textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const eng = engMap[`${c.ref}||${c.taille}`] || 0
                const reliquat = Math.max(0, c.qte_commandee - c.qte_livree - eng)
                const val = lignes[c.id] ?? ''
                const delta = parseInt(val) || 0
                const hasValue = delta > 0
                return (
                  <tr key={c.id} style={{ borderBottom:'1px solid #1a1a1a', background: hasValue ? '#0d1f12' : 'transparent' }}>
                    <td style={{ padding:'9px 12px', fontWeight:500, color: hasValue ? '#ddd' : '#888' }}>{c.produit}</td>
                    <td style={{ padding:'9px 12px', color:'#666', fontSize:11 }}>{c.taille || '—'}</td>
                    <td style={{ padding:'9px 12px', textAlign:'right', color:'#666' }}>{c.qte_commandee}</td>
                    <td style={{ padding:'9px 12px', textAlign:'right', color:'#2ed573' }}>{c.qte_livree}</td>
                    <td style={{ padding:'9px 12px', textAlign:'right', color: reliquat > 0 ? '#ff4757' : '#555', fontWeight: reliquat > 0 ? 500 : 400 }}>{reliquat}</td>
                    <td style={{ padding:'6px 12px', textAlign:'right' }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={val}
                        onChange={e => setQty(c.id, e.target.value)}
                        placeholder="0"
                        style={{
                          width:64, textAlign:'right', padding:'5px 8px',
                          background: hasValue ? '#1a3d22' : '#1c1c1c',
                          border: `1px solid ${hasValue ? '#2ed57366' : '#2a2a2a'}`,
                          borderRadius:6, color: hasValue ? '#2ed573' : '#666',
                          fontSize:13, fontWeight: hasValue ? 600 : 400
                        }}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ padding:'16px 24px', borderTop:'1px solid #1e1e1e', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <div style={{ fontSize:12, color: nbLignesSaisies > 0 ? '#2ed573' : '#555' }}>
            {nbLignesSaisies > 0
              ? `✓ ${nbLignesSaisies} article${nbLignesSaisies > 1 ? 's' : ''} · ${totalSaisi} unité${totalSaisi > 1 ? 's' : ''} à enregistrer`
              : 'Aucune quantité saisie'
            }
          </div>
          {saveError && (
            <div style={{ fontSize:11, color:'#ff4757', flex:1, textAlign:'center' }}>
              Erreur: {saveError}
            </div>
          )}
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onClose} disabled={saving} style={{ padding:'8px 16px', borderRadius:8, border:'1px solid #333', background:'transparent', color:'#888', cursor:'pointer', fontSize:13 }}>
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding:'8px 20px', borderRadius:8, border:'none',
                background: nbLignesSaisies > 0 ? '#1a6b35' : '#1a3d22',
                color: nbLignesSaisies > 0 ? '#2ed573' : '#555',
                cursor: saving ? 'wait' : 'pointer', fontSize:13, fontWeight:500
              }}
            >
              {saving ? 'Enregistrement...' : nbLignesSaisies > 0 ? `✓ Enregistrer (${totalSaisi} unités)` : 'Fermer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
// ────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [commandes, setCommandes] = useState([])
  const [livraisons, setLivraisons] = useState([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [tab, setTab] = useState('commandes')
  const [search, setSearch] = useState('')
  const [filtCat, setFiltCat] = useState('all')
  const [filtStatut, setFiltStatut] = useState('all')
  const [expanded, setExpanded] = useState(new Set())
  const [saisieModal, setSaisieModal] = useState(null) // livraison object or null

  // Build engagement map: ref||taille -> total engaged qty
  const engMap = {}
  for (const e of ENGAGEMENTS) {
    const k = `${e.ref}||${e.taille}`
    engMap[k] = (engMap[k] || 0) + e.qte
  }

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: cmds }, { data: livs }] = await Promise.all([
      supabase.from('commandes').select('*').order('bc').order('produit').order('taille'),
      supabase.from('livraisons').select('*').order('date_livraison'),
    ])
    setCommandes(cmds || [])
    setLivraisons(livs || [])
    setLoading(false)
  }

  async function seedDatabase() {
    setSeeding(true)
    await supabase.from('commandes').delete().neq('id', 0)
    await supabase.from('livraisons').delete().neq('id', 0)
    await supabase.from('commandes').insert(SEED_COMMANDES)
    await supabase.from('livraisons').insert(SEED_LIVRAISONS)
    await loadData()
    setSeeding(false)
  }

  function toggleExpand(key) {
    setExpanded(prev => { const n=new Set(prev); n.has(key)?n.delete(key):n.add(key); return n })
  }

  const filtered = commandes.filter(c => {
    const rel = c.qte_commandee - c.qte_livree
    const eng = engMap[`${c.ref}||${c.taille}`] || 0
    const vraiReliquat = Math.max(0, rel - eng)
    const matchSearch = !search || c.produit?.toLowerCase().includes(search.toLowerCase()) || c.ref?.toLowerCase().includes(search.toLowerCase()) || c.bc?.toLowerCase().includes(search.toLowerCase())
    const matchCat = filtCat === 'all' || c.categorie === filtCat
    const matchSt = filtStatut === 'all' ||
      (filtStatut === 'Soldé' && rel <= 0) ||
      (filtStatut === 'Engagé' && rel > 0 && vraiReliquat === 0) ||
      (filtStatut === 'Partiel' && vraiReliquat > 0 && c.qte_livree > 0) ||
      (filtStatut === 'Ouvert' && vraiReliquat > 0 && c.qte_livree === 0)
    return matchSearch && matchCat && matchSt
  })

  const groups = groupByModel(filtered, engMap)
  const cats = [...new Set(commandes.map(c => c.categorie))]

  const totalCmd = filtered.reduce((s,c)=>s+c.qte_commandee,0)
  const totalLiv = filtered.reduce((s,c)=>s+c.qte_livree,0)
  const totalEng = filtered.reduce((s,c)=>s+(engMap[`${c.ref}||${c.taille}`]||0),0)
  const totalReliquat = Math.max(0, totalCmd - totalLiv - totalEng)
  const totalFA = livraisons.filter(l=>l.statut==='Réceptionné'||l.statut==='En cours de vérification').reduce((s,l)=>s+(l.montant_ht||0),0)
  const totalEnRoute = livraisons.filter(l=>l.statut==='En route'||l.statut==='En cours de vérification').reduce((s,l)=>s+(l.montant_ht||0),0)
  const totalProforma = livraisons.filter(l=>l.statut==='Proformé').reduce((s,l)=>s+(l.montant_ht||0),0)

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'#555'}}>Chargement...</div>

  if (commandes.length === 0) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',gap:16}}>
      <div style={{color:'#888',fontSize:15}}>Base vide — importer les données SS26 ?</div>
      <button onClick={seedDatabase} disabled={seeding} style={{background:'#e8e8e8',color:'#111',border:'none',borderRadius:8,padding:'10px 20px',fontSize:14,fontWeight:500,cursor:'pointer'}}>
        {seeding ? 'Import en cours...' : '⬆ Importer données SS26'}
      </button>
    </div>
  )

  return (
    <div style={{padding:'20px 28px',minHeight:'100vh'}}>
      {/* Saisie Modal */}
      {saisieModal && (
        <SaisieModal
          livraison={saisieModal}
          commandes={commandes}
          engMap={engMap}
          onClose={() => setSaisieModal(null)}
          onSave={async () => {
            setSaisieModal(null)
            await loadData()
          }}
        />
      )}

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:10}}>
        <div>
          <div style={{fontSize:20,fontWeight:500,color:'#fff'}}>Suivi commandes fournisseurs</div>
          <div style={{fontSize:12,color:'#444',marginTop:3}}>Circular Stream SL · F.one · Saison SS26</div>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          <select value={filtStatut} onChange={e=>setFiltStatut(e.target.value)}>
            <option value="all">Tous statuts</option>
            <option value="Soldé">Soldé</option>
            <option value="Engagé">Engagé (reliquat couvert)</option>
            <option value="Partiel">Partiel</option>
            <option value="Ouvert">Ouvert</option>
          </select>
          <button onClick={seedDatabase} disabled={seeding} style={{background:'#222',color:'#666',border:'1px solid #333',borderRadius:8,padding:'7px 12px',fontSize:12,cursor:'pointer'}}>
            {seeding?'...':'↺ Reseed'}
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap'}}>
        {[
          {label:'Facturé / vérifié', value:`${totalFA.toLocaleString('fr-FR',{maximumFractionDigits:0})} €`, color:'#2ed573'},
          {label:'En route / vérification', value:`${totalEnRoute.toLocaleString('fr-FR',{maximumFractionDigits:0})} €`, color:'#f9ca24'},
          {label:'Proformé (à venir)', value:`${totalProforma.toLocaleString('fr-FR',{maximumFractionDigits:0})} €`, color:'#4a9eff'},
          {label:'Vrai reliquat restant', value:totalReliquat.toLocaleString(), color:totalReliquat>0?'#ff4757':'#2ed573'},
        ].map(m=>(
          <div key={m.label} style={{background:'#1c1c1c',borderRadius:10,padding:'14px 16px',border:'1px solid #222',flex:1,minWidth:150}}>
            <div style={{fontSize:11,color:'#555',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>{m.label}</div>
            <div style={{fontSize:20,fontWeight:500,color:m.color}}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:'flex',borderBottom:'1px solid #222',marginBottom:16}}>
        {['commandes','livraisons','reliquats'].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{padding:'9px 18px',fontSize:13,cursor:'pointer',background:'none',border:'none',borderBottom:tab===t?'2px solid #fff':'2px solid transparent',color:tab===t?'#fff':'#555',textTransform:'capitalize'}}>
            {t}
            {t==='livraisons'&&<span style={{display:'inline-block',width:6,height:6,background:'#ff9f43',borderRadius:'50%',marginLeft:5,verticalAlign:'middle'}}/>}
          </button>
        ))}
      </div>

      {/* Tab Commandes */}
      {tab==='commandes'&&(
        <>
          <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher article / réf. / BC..." style={{flex:1,minWidth:200}}/>
            <ExportBar
              label={`${filtered.length} lignes`}
              onCSV={() => {
                const hdrs = ['BC','Réf','Entité','Produit','Taille','Catégorie','Commandé','Réceptionné','Engagé','Reliquat net','% Livré','Prix U.','Livraison prévue']
                const rows = filtered.map(c => {
                  const eng = engMap[`${c.ref}||${c.taille}`] || 0
                  const rel = Math.max(0, c.qte_commandee - c.qte_livree - eng)
                  const pct = c.qte_commandee > 0 ? Math.round(c.qte_livree / c.qte_commandee * 100) : 0
                  return [c.bc, c.ref, c.entite, c.produit, c.taille, c.categorie, c.qte_commandee, c.qte_livree, eng || '', rel, pct + '%', c.prix_u, c.livraison_prevue]
                })
                exportCSV(`Commandes_SS26_${new Date().toISOString().slice(0,10)}.csv`, hdrs, rows)
              }}
              onXLSX={() => {
                const hdrs = ['BC','Réf','Entité','Produit','Taille','Catégorie','Commandé','Réceptionné','Engagé','Reliquat net','% Livré','Prix U.','Livraison prévue']
                const rows = filtered.map(c => {
                  const eng = engMap[`${c.ref}||${c.taille}`] || 0
                  const rel = Math.max(0, c.qte_commandee - c.qte_livree - eng)
                  const pct = c.qte_commandee > 0 ? Math.round(c.qte_livree / c.qte_commandee * 100) : 0
                  return [c.bc, c.ref, c.entite, c.produit, c.taille, c.categorie, c.qte_commandee, c.qte_livree, eng || 0, rel, pct / 100, c.prix_u, c.livraison_prevue]
                })
                exportXLSX(`Commandes_SS26_${new Date().toISOString().slice(0,10)}.xlsx`, 'Commandes', hdrs, rows)
              }}
            />
          </div>
          <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:14}}>
            {['all',...cats].map(c=>(
              <button key={c} onClick={()=>setFiltCat(c)} style={{padding:'4px 11px',borderRadius:20,fontSize:11,cursor:'pointer',border:`1px solid ${filtCat===c?'#555':'#333'}`,background:filtCat===c?'#2a2a2a':'transparent',color:filtCat===c?'#ddd':'#555'}}>
                {c==='all'?'Toutes':c}
              </button>
            ))}
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr>{['','Réf BC','Fournisseur','Article','Catégorie','Commandé','Réceptionné','Engagé','Vrai reliquat','Avancement'].map((h,i)=>(
                  <th key={i} style={{textAlign:i>=5?'right':'left',padding:'8px 10px',color:'#444',borderBottom:'1px solid #1e1e1e',fontSize:10,textTransform:'uppercase',letterSpacing:'0.06em',whiteSpace:'nowrap'}}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {groups.map(g=>{
                  const key=`${g.bc}||${g.ref}||${g.produit}`
                  const isOpen=expanded.has(key)
                  const vraiRel=Math.max(0,g.qte_commandee-g.qte_livree-g.qte_engagee)
                  const hasMultiple=g.rows.length>1
                  return [
                    <tr key={key} onClick={()=>hasMultiple&&toggleExpand(key)}
                      style={{borderBottom:isOpen?'1px solid #2a2a2a':'1px solid #1a1a1a',cursor:hasMultiple?'pointer':'default',background:isOpen?'#181818':'transparent'}}
                      onMouseEnter={e=>{if(!isOpen)e.currentTarget.style.background='#161616'}}
                      onMouseLeave={e=>{if(!isOpen)e.currentTarget.style.background='transparent'}}>
                      <td style={{padding:'10px 8px',width:20,color:'#444',fontSize:12}}>{hasMultiple?(isOpen?'▾':'▸'):''}</td>
                      <td style={{padding:'10px 10px'}}>
                        <div style={{fontWeight:600,color:'#fff',fontSize:13}}>{g.bc}</div>
                        <div style={{fontSize:10,color:'#444',marginTop:2}}>{g.ref}</div>
                      </td>
                      <td style={{padding:'10px 10px',fontSize:11,color:'#555'}}>{g.fournisseur}</td>
                      <td style={{padding:'10px 10px'}}>
                        <div style={{fontWeight:500,color:'#ddd',fontSize:13}}>{g.produit}</div>
                        {hasMultiple&&<div style={{fontSize:10,color:'#444',marginTop:2}}>{g.rows.length} tailles</div>}
                        {!hasMultiple&&g.rows[0]?.taille&&<div style={{fontSize:10,color:'#555',marginTop:2}}>{g.rows[0].taille}</div>}
                      </td>
                      <td style={{padding:'10px 10px'}}><span style={{fontSize:10,color:'#555',background:'#1c1c1c',border:'1px solid #2a2a2a',padding:'2px 7px',borderRadius:10}}>{g.categorie}</span></td>
                      <td style={{padding:'10px 10px',textAlign:'right'}}>{g.qte_commandee}</td>
                      <td style={{padding:'10px 10px',textAlign:'right',color:'#2ed573'}}>{g.qte_livree}</td>
                      <td style={{padding:'10px 10px',textAlign:'right',color:'#ff9f43'}}>{g.qte_engagee||'—'}</td>
                      <td style={{padding:'10px 10px',textAlign:'right',fontWeight:500,color:vraiRel>0?'#ff4757':'#2ed573'}}>{vraiRel}</td>
                      <td style={{padding:'10px 10px'}}><ProgressBar liv={g.qte_livree} eng={g.qte_engagee} cmd={g.qte_commandee}/></td>
                    </tr>,
                    ...(isOpen?g.rows.map((r,ri)=>{
                      const rEng=engMap[`${r.ref}||${r.taille}`]||0
                      const rRel=Math.max(0,r.qte_commandee-r.qte_livree-rEng)
                      return(
                        <tr key={`${key}-${ri}`} style={{borderBottom:'1px solid #141414',background:'#141414'}}>
                          <td style={{padding:'7px 8px'}}/>
                          <td style={{padding:'7px 10px'}}/>
                          <td style={{padding:'7px 10px'}}/>
                          <td style={{padding:'7px 10px 7px 20px'}}><div style={{fontSize:12,color:'#888'}}>↳ {r.taille||'—'}</div></td>
                          <td style={{padding:'7px 10px'}}/>
                          <td style={{padding:'7px 10px',textAlign:'right',fontSize:12,color:'#777'}}>{r.qte_commandee}</td>
                          <td style={{padding:'7px 10px',textAlign:'right',fontSize:12,color:'#2ed573'}}>{r.qte_livree}</td>
                          <td style={{padding:'7px 10px',textAlign:'right',fontSize:12,color:'#ff9f43'}}>{rEng||'—'}</td>
                          <td style={{padding:'7px 10px',textAlign:'right',fontSize:12,fontWeight:500,color:rRel>0?'#ff4757':'#2ed573'}}>{rRel}</td>
                          <td style={{padding:'7px 10px'}}><ProgressBar liv={r.qte_livree} eng={rEng} cmd={r.qte_commandee}/></td>
                        </tr>
                      )
                    }):[])
                  ]
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Tab Livraisons */}
      {tab==='livraisons'&&(
        <>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:6}}>
            <ExportBar
              label={`${livraisons.length} livraisons`}
              onCSV={() => {
                const hdrs = ['Réf','Type','Date livraison','Entité','Qté','Montant HT','Statut','Notes']
                const rows = livraisons.map(l => [l.facture, l.type, l.date_livraison, l.entite, l.qte_totale, l.montant_ht, l.statut, l.notes])
                exportCSV(`Livraisons_SS26_${new Date().toISOString().slice(0,10)}.csv`, hdrs, rows)
              }}
              onXLSX={() => {
                const hdrs = ['Réf','Type','Date livraison','Entité','Qté','Montant HT','Statut','Notes']
                const rows = livraisons.map(l => [l.facture, l.type, l.date_livraison, l.entite, l.qte_totale, l.montant_ht, l.statut, l.notes])
                exportXLSX(`Livraisons_SS26_${new Date().toISOString().slice(0,10)}.xlsx`, 'Livraisons', hdrs, rows)
              }}
            />
          </div>
          {/* Info banner */}
          <div style={{ marginBottom:14, padding:'10px 16px', background:'#1a1a1a', borderRadius:8, border:'1px solid #252525', fontSize:12, color:'#666', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{color:'#ff9f43'}}>📝</span>
            <span>Cliquez sur <strong style={{color:'#ddd'}}>Saisir les lignes</strong> pour enregistrer les quantités reçues d'une livraison et mettre à jour le réceptionné automatiquement.</span>
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr>{['Réf','Type','Date prévu','Entité','Qté','Montant HT','Statut','Notes',''].map((h,i)=>(
                  <th key={i} style={{textAlign:i>=4&&i<=5?'right':'left',padding:'8px 10px',color:'#444',borderBottom:'1px solid #1e1e1e',fontSize:10,textTransform:'uppercase',letterSpacing:'0.06em',whiteSpace:'nowrap'}}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {livraisons.map((l,i)=>(
                  <tr key={i} style={{borderBottom:'1px solid #1a1a1a'}}>
                    <td style={{padding:'12px 10px',fontWeight:600,color:'#fff',fontFamily:'monospace',fontSize:12}}>{l.facture}</td>
                    <td style={{padding:'12px 10px',fontSize:11,color:'#666'}}>{l.type}</td>
                    <td style={{padding:'12px 10px',fontSize:11,color:'#888'}}>{l.date_livraison?new Date(l.date_livraison).toLocaleDateString('fr-FR'):'—'}</td>
                    <td style={{padding:'12px 10px',fontSize:11,color:'#666'}}>{l.entite}</td>
                    <td style={{padding:'12px 10px',textAlign:'right'}}>{l.qte_totale?.toLocaleString()}</td>
                    <td style={{padding:'12px 10px',textAlign:'right',color:'#ddd'}}>{l.montant_ht?.toLocaleString('fr-FR',{minimumFractionDigits:2})} €</td>
                    <td style={{padding:'12px 10px'}}><Badge status={l.statut}/></td>
                    <td style={{padding:'12px 10px',fontSize:11,color:'#555',maxWidth:200}}>{l.notes}</td>
                    <td style={{padding:'8px 10px',whiteSpace:'nowrap'}}>
                      <button
                        onClick={() => setSaisieModal(l)}
                        style={{
                          padding:'5px 12px', borderRadius:6, fontSize:11, cursor:'pointer',
                          background:'#1a2a3a', border:'1px solid #1e3a5a', color:'#4a9eff',
                          fontWeight:500, whiteSpace:'nowrap'
                        }}
                      >
                        📝 Saisir les lignes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{borderTop:'1px solid #333'}}>
                  <td colSpan={4} style={{padding:'12px 10px',fontSize:11,color:'#555'}}>Total {livraisons.length} mouvements</td>
                  <td style={{padding:'12px 10px',textAlign:'right',color:'#ddd'}}>{livraisons.reduce((s,l)=>s+(l.qte_totale||0),0).toLocaleString()}</td>
                  <td style={{padding:'12px 10px',textAlign:'right',color:'#ff9f43'}}>{livraisons.reduce((s,l)=>s+(l.montant_ht||0),0).toLocaleString('fr-FR',{minimumFractionDigits:2})} €</td>
                  <td colSpan={3}/>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {/* Tab Reliquats */}
      {tab==='reliquats'&&(
        <>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}>
            {(() => {
              const relRows = groups.filter(g=>Math.max(0,g.qte_commandee-g.qte_livree-g.qte_engagee)>0)
              const hdrs = ['BC','Réf','Produit','Catégorie','Commandé','Réceptionné','Engagé','Reliquat net']
              const buildRows = (flat) => flat.flatMap(g => {
                const rel = Math.max(0,g.qte_commandee-g.qte_livree-g.qte_engagee)
                const mainRow = [g.bc, g.ref, g.produit, g.categorie, g.qte_commandee, g.qte_livree, g.qte_engagee||0, rel]
                const subRows = g.rows.filter(r=>Math.max(0,r.qte_commandee-r.qte_livree-(engMap[`${r.ref}||${r.taille}`]||0))>0)
                  .map(r => { const rEng=engMap[`${r.ref}||${r.taille}`]||0; return ['','',`  ${r.taille}`,g.categorie,r.qte_commandee,r.qte_livree,rEng,Math.max(0,r.qte_commandee-r.qte_livree-rEng)] })
                return g.rows.length > 1 ? [mainRow, ...subRows] : [mainRow]
              })
              return (
                <ExportBar
                  label={`${relRows.length} articles`}
                  onCSV={() => exportCSV(`Reliquats_SS26_${new Date().toISOString().slice(0,10)}.csv`, hdrs, buildRows(relRows))}
                  onXLSX={() => exportXLSX(`Reliquats_SS26_${new Date().toISOString().slice(0,10)}.xlsx`, 'Reliquats', hdrs, buildRows(relRows))}
                />
              )
            })()}
          </div>
          <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr>{['','Réf BC','Article','Catégorie','Commandé','Réceptionné','Engagé','Vrai reliquat'].map((h,i)=>(
                <th key={i} style={{textAlign:i>=4?'right':'left',padding:'8px 10px',color:'#444',borderBottom:'1px solid #1e1e1e',fontSize:10,textTransform:'uppercase',letterSpacing:'0.06em',whiteSpace:'nowrap'}}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {groups.filter(g=>Math.max(0,g.qte_commandee-g.qte_livree-g.qte_engagee)>0).map(g=>{
                const key=`rel-${g.bc}-${g.ref}-${g.produit}`
                const isOpen=expanded.has(key)
                const vraiRel=Math.max(0,g.qte_commandee-g.qte_livree-g.qte_engagee)
                const hasMultiple=g.rows.filter(r=>Math.max(0,r.qte_commandee-r.qte_livree-(engMap[`${r.ref}||${r.taille}`]||0))>0).length>1
                return [
                  <tr key={key} onClick={()=>hasMultiple&&toggleExpand(key)}
                    style={{borderBottom:isOpen?'1px solid #2a2a2a':'1px solid #1a1a1a',cursor:hasMultiple?'pointer':'default',background:isOpen?'#181818':'transparent'}}
                    onMouseEnter={e=>{if(!isOpen)e.currentTarget.style.background='#161616'}}
                    onMouseLeave={e=>{if(!isOpen)e.currentTarget.style.background='transparent'}}>
                    <td style={{padding:'10px 8px',width:20,color:'#444',fontSize:12}}>{hasMultiple?(isOpen?'▾':'▸'):''}</td>
                    <td style={{padding:'10px 10px'}}>
                      <div style={{fontWeight:600,color:'#fff',fontSize:13}}>{g.bc}</div>
                      <div style={{fontSize:10,color:'#444',marginTop:2}}>{g.ref}</div>
                    </td>
                    <td style={{padding:'10px 10px'}}><div style={{fontWeight:500,color:'#ddd'}}>{g.produit}</div></td>
                    <td style={{padding:'10px 10px'}}><span style={{fontSize:10,color:'#555',background:'#1c1c1c',border:'1px solid #2a2a2a',padding:'2px 7px',borderRadius:10}}>{g.categorie}</span></td>
                    <td style={{padding:'10px 10px',textAlign:'right'}}>{g.qte_commandee}</td>
                    <td style={{padding:'10px 10px',textAlign:'right',color:'#2ed573'}}>{g.qte_livree}</td>
                    <td style={{padding:'10px 10px',textAlign:'right',color:'#ff9f43'}}>{g.qte_engagee||'—'}</td>
                    <td style={{padding:'10px 10px',textAlign:'right',fontWeight:500,color:'#ff4757'}}>{vraiRel}</td>
                  </tr>,
                  ...(isOpen?g.rows.filter(r=>Math.max(0,r.qte_commandee-r.qte_livree-(engMap[`${r.ref}||${r.taille}`]||0))>0).map((r,ri)=>{
                    const rEng=engMap[`${r.ref}||${r.taille}`]||0
                    const rRel=Math.max(0,r.qte_commandee-r.qte_livree-rEng)
                    return(
                      <tr key={`${key}-${ri}`} style={{borderBottom:'1px solid #141414',background:'#141414'}}>
                        <td style={{padding:'7px 8px'}}/>
                        <td style={{padding:'7px 10px'}}/>
                        <td style={{padding:'7px 10px 7px 20px'}}><div style={{fontSize:12,color:'#888'}}>↳ {r.taille||'—'}</div></td>
                        <td style={{padding:'7px 10px'}}/>
                        <td style={{padding:'7px 10px',textAlign:'right',fontSize:12,color:'#777'}}>{r.qte_commandee}</td>
                        <td style={{padding:'7px 10px',textAlign:'right',fontSize:12,color:'#2ed573'}}>{r.qte_livree}</td>
                        <td style={{padding:'7px 10px',textAlign:'right',fontSize:12,color:'#ff9f43'}}>{rEng||'—'}</td>
                        <td style={{padding:'7px 10px',textAlign:'right',fontSize:12,fontWeight:500,color:'#ff4757'}}>{rRel}</td>
                      </tr>
                    )
                  }):[])
                ]
              })}
            </tbody>
            <tfoot>
              <tr style={{borderTop:'1px solid #333'}}>
                <td colSpan={7} style={{padding:'12px 10px',fontSize:11,color:'#555'}}>Vrai reliquat total (hors engagements)</td>
                <td style={{padding:'12px 10px',textAlign:'right',fontWeight:500,color:'#ff4757'}}>{totalReliquat.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
          </div>
        </>
      )}
    </div>
  )
}
