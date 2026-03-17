import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { SEED_COMMANDES, SEED_LIVRAISONS } from './lib/seedData'
import './App.css'

const TODAY = new Date('2026-03-17')

function getStatus(qte_commandee, qte_livree, livraison_prevue) {
  const rel = qte_commandee - qte_livree
  if (rel <= 0) return 'Soldé'
  if (livraison_prevue && new Date(livraison_prevue) < TODAY) return 'Retard'
  if (qte_livree === 0) return 'Ouvert'
  return 'Partiel'
}

function Badge({ status }) {
  const s = {
    Soldé:  { bg:'#0d2b1a', color:'#2ed573', border:'#1a4a2a' },
    Partiel:{ bg:'#2b1e0a', color:'#ff9f43', border:'#4a3010' },
    Ouvert: { bg:'#0a1a2b', color:'#4a9eff', border:'#102840' },
    Retard: { bg:'#2b0a0a', color:'#ff4757', border:'#4a1010' },
  }[status] || {}
  return <span style={{ display:'inline-block', padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:500, background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>{status}</span>
}

function ProgressBar({ liv, cmd }) {
  const p = cmd > 0 ? Math.round(liv / cmd * 100) : 0
  const color = p === 100 ? '#2ed573' : p > 0 ? '#ff9f43' : '#333'
  return (
    <div style={{ minWidth: 80 }}>
      <div style={{ height: 5, background: '#222', borderRadius: 3, marginBottom: 3 }}>
        <div style={{ height: '100%', width: `${p}%`, background: color, borderRadius: 3 }} />
      </div>
      <div style={{ fontSize: 10, color: '#555' }}>{p}%</div>
    </div>
  )
}

// Groupe les lignes par produit (bc + ref + produit)
function groupByModel(rows) {
  const map = new Map()
  for (const r of rows) {
    const key = `${r.bc}||${r.ref}||${r.produit}`
    if (!map.has(key)) {
      map.set(key, { bc: r.bc, ref: r.ref, fournisseur: r.fournisseur, produit: r.produit, categorie: r.categorie, livraison_prevue: r.livraison_prevue, rows: [] })
    }
    map.get(key).rows.push(r)
  }
  return Array.from(map.values()).map(g => ({
    ...g,
    qte_commandee: g.rows.reduce((s, r) => s + r.qte_commandee, 0),
    qte_livree: g.rows.reduce((s, r) => s + r.qte_livree, 0),
    prix_u: g.rows[0].prix_u,
    hasSizes: g.rows.length > 1 || g.rows[0].taille,
  }))
}

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
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const filtered = commandes.filter(c => {
    const st = getStatus(c.qte_commandee, c.qte_livree, c.livraison_prevue)
    const matchSearch = !search || c.produit?.toLowerCase().includes(search.toLowerCase()) || c.ref?.toLowerCase().includes(search.toLowerCase()) || c.bc?.toLowerCase().includes(search.toLowerCase())
    return matchSearch && (filtCat === 'all' || c.categorie === filtCat) && (filtStatut === 'all' || st === filtStatut)
  })

  const groups = groupByModel(filtered)
  const cats = [...new Set(commandes.map(c => c.categorie))]

  const totalRel = filtered.reduce((s, c) => s + Math.max(0, c.qte_commandee - c.qte_livree), 0)
  const valRel = filtered.reduce((s, c) => s + Math.max(0, c.qte_commandee - c.qte_livree) * (c.prix_u || 0), 0)
  const retards = groups.filter(g => getStatus(g.qte_commandee, g.qte_livree, g.livraison_prevue) === 'Retard').length
  const actives = groups.filter(g => getStatus(g.qte_commandee, g.qte_livree, g.livraison_prevue) !== 'Soldé').length
  const totalFA = livraisons.reduce((s, l) => s + (l.montant_ht || 0), 0)

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'#555' }}>Chargement...</div>

  if (commandes.length === 0) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:16 }}>
      <div style={{ color:'#888', fontSize:15 }}>Base vide — importer les données SS26 ?</div>
      <button onClick={seedDatabase} disabled={seeding} style={{ background:'#e8e8e8', color:'#111', border:'none', borderRadius:8, padding:'10px 20px', fontSize:14, fontWeight:500, cursor:'pointer' }}>
        {seeding ? 'Import en cours...' : '⬆ Importer données SS26'}
      </button>
    </div>
  )

  return (
    <div style={{ padding:'20px 28px', minHeight:'100vh' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:500, color:'#fff' }}>Suivi commandes fournisseurs</div>
          <div style={{ fontSize:12, color:'#444', marginTop:3 }}>Circular Stream SL · F.one · Saison SS26</div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <select value={filtStatut} onChange={e => setFiltStatut(e.target.value)}>
            <option value="all">Tous statuts</option>
            {['Soldé','Partiel','Ouvert','Retard'].map(s => <option key={s}>{s}</option>)}
          </select>
          <button onClick={seedDatabase} disabled={seeding} style={{ background:'#222', color:'#666', border:'1px solid #333', borderRadius:8, padding:'7px 12px', fontSize:12, cursor:'pointer' }}>
            {seeding ? '...' : '↺ Reseed'}
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        {[
          { label:'Modèles actifs', value:actives, color:'#4a9eff' },
          { label:'Unités en reliquat', value:totalRel.toLocaleString(), color:'#ff9f43' },
          { label:'Valeur reliquat', value:`${Math.round(valRel).toLocaleString('fr-FR')} €`, color:'#ff9f43' },
          { label:'Alertes retard', value:retards, color: retards > 0 ? '#ff4757' : '#2ed573' },
          { label:'Facturé HT', value:`${totalFA.toLocaleString('fr-FR', {maximumFractionDigits:0})} €`, color:'#fff' },
        ].map(m => (
          <div key={m.label} style={{ background:'#1c1c1c', borderRadius:10, padding:'14px 16px', border:'1px solid #222', flex:1, minWidth:130 }}>
            <div style={{ fontSize:11, color:'#555', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' }}>{m.label}</div>
            <div style={{ fontSize:22, fontWeight:500, color:m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid #222', marginBottom:16 }}>
        {['commandes','livraisons','reliquats'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding:'9px 18px', fontSize:13, cursor:'pointer', background:'none', border:'none', borderBottom: tab===t ? '2px solid #fff' : '2px solid transparent', color: tab===t ? '#fff' : '#555', textTransform:'capitalize' }}>
            {t}{t==='livraisons' && <span style={{ display:'inline-block', width:6, height:6, background:'#ff4757', borderRadius:'50%', marginLeft:5, verticalAlign:'middle' }} />}
          </button>
        ))}
      </div>

      {/* Tab Commandes */}
      {tab === 'commandes' && (
        <>
          <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher article / réf. / BC..." style={{ flex:1, minWidth:200 }} />
          </div>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:14 }}>
            {['all',...cats].map(c => (
              <button key={c} onClick={() => setFiltCat(c)} style={{ padding:'4px 11px', borderRadius:20, fontSize:11, cursor:'pointer', border:`1px solid ${filtCat===c?'#555':'#333'}`, background: filtCat===c?'#2a2a2a':'transparent', color: filtCat===c?'#ddd':'#555' }}>
                {c==='all'?'Toutes':c}
              </button>
            ))}
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr>
                  {['','Réf BC','Fournisseur','Article','Catégorie','Commandé','Livré','Reliquat','Avancement','Statut'].map((h,i) => (
                    <th key={i} style={{ textAlign: i>=5&&i<=7?'right':'left', padding:'8px 10px', color:'#444', borderBottom:'1px solid #1e1e1e', fontSize:10, textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((g, gi) => {
                  const key = `${g.bc}||${g.ref}||${g.produit}`
                  const isOpen = expanded.has(key)
                  const rel = g.qte_commandee - g.qte_livree
                  const st = getStatus(g.qte_commandee, g.qte_livree, g.livraison_prevue)
                  const hasMultiple = g.rows.length > 1 || g.rows[0]?.taille
                  return [
                    // Ligne groupe
                    <tr key={key} onClick={() => hasMultiple && toggleExpand(key)}
                      style={{ borderBottom: isOpen ? '1px solid #2a2a2a' : '1px solid #1a1a1a', cursor: hasMultiple ? 'pointer' : 'default', background: isOpen ? '#181818' : 'transparent' }}
                      onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background='#161616' }}
                      onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background='transparent' }}>
                      <td style={{ padding:'10px 8px', width:20, color:'#444', fontSize:12 }}>
                        {hasMultiple ? (isOpen ? '▾' : '▸') : ''}
                      </td>
                      <td style={{ padding:'10px 10px' }}>
                        <div style={{ fontWeight:600, color:'#fff', fontSize:13 }}>{g.bc}</div>
                        <div style={{ fontSize:10, color:'#444', marginTop:2 }}>{g.ref}</div>
                      </td>
                      <td style={{ padding:'10px 10px', fontSize:11, color:'#555' }}>{g.fournisseur}</td>
                      <td style={{ padding:'10px 10px' }}>
                        <div style={{ fontWeight:500, color:'#ddd', fontSize:13 }}>{g.produit}</div>
                        {!hasMultiple && g.rows[0]?.taille && <div style={{ fontSize:10, color:'#555', marginTop:2 }}>{g.rows[0].taille}</div>}
                        {hasMultiple && <div style={{ fontSize:10, color:'#444', marginTop:2 }}>{g.rows.length} tailles</div>}
                      </td>
                      <td style={{ padding:'10px 10px' }}><span style={{ fontSize:10, color:'#555', background:'#1c1c1c', border:'1px solid #2a2a2a', padding:'2px 7px', borderRadius:10 }}>{g.categorie}</span></td>
                      <td style={{ padding:'10px 10px', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{g.qte_commandee}</td>
                      <td style={{ padding:'10px 10px', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{g.qte_livree}</td>
                      <td style={{ padding:'10px 10px', textAlign:'right', fontWeight: rel>0?500:400, color: rel>0?'#ff9f43':'#2ed573', fontVariantNumeric:'tabular-nums' }}>{rel}</td>
                      <td style={{ padding:'10px 10px' }}><ProgressBar liv={g.qte_livree} cmd={g.qte_commandee} /></td>
                      <td style={{ padding:'10px 10px' }}><Badge status={st} /></td>
                    </tr>,
                    // Lignes détail par taille (si expandé)
                    ...(isOpen ? g.rows.map((r, ri) => {
                      const rrel = r.qte_commandee - r.qte_livree
                      const rst = getStatus(r.qte_commandee, r.qte_livree, r.livraison_prevue)
                      return (
                        <tr key={`${key}-${ri}`} style={{ borderBottom:'1px solid #141414', background:'#141414' }}>
                          <td style={{ padding:'7px 8px' }} />
                          <td style={{ padding:'7px 10px' }} />
                          <td style={{ padding:'7px 10px' }} />
                          <td style={{ padding:'7px 10px 7px 20px' }}>
                            <div style={{ fontSize:12, color:'#888' }}>↳ {r.taille || '—'}</div>
                          </td>
                          <td style={{ padding:'7px 10px' }} />
                          <td style={{ padding:'7px 10px', textAlign:'right', fontSize:12, color:'#777' }}>{r.qte_commandee}</td>
                          <td style={{ padding:'7px 10px', textAlign:'right', fontSize:12, color:'#777' }}>{r.qte_livree}</td>
                          <td style={{ padding:'7px 10px', textAlign:'right', fontSize:12, fontWeight: rrel>0?500:400, color: rrel>0?'#cc7a30':'#1ea355' }}>{rrel}</td>
                          <td style={{ padding:'7px 10px' }}><ProgressBar liv={r.qte_livree} cmd={r.qte_commandee} /></td>
                          <td style={{ padding:'7px 10px' }}><Badge status={rst} /></td>
                        </tr>
                      )
                    }) : [])
                  ]
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Tab Livraisons */}
      {tab === 'livraisons' && (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr>
                {['Facture','Date livraison','Transport','Entité','Lignes','Qté','Montant HT','Statut'].map((h,i) => (
                  <th key={i} style={{ textAlign: i>=4&&i<=6?'right':'left', padding:'8px 10px', color:'#444', borderBottom:'1px solid #1e1e1e', fontSize:10, textTransform:'uppercase', letterSpacing:'0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {livraisons.map((l, i) => (
                <tr key={i} style={{ borderBottom:'1px solid #1a1a1a' }}>
                  <td style={{ padding:'12px 10px', fontWeight:600, color:'#fff', fontFamily:'monospace', fontSize:13 }}>{l.facture}</td>
                  <td style={{ padding:'12px 10px', fontSize:11, color:'#888' }}>{new Date(l.date_livraison).toLocaleDateString('fr-FR')}</td>
                  <td style={{ padding:'12px 10px', fontSize:11, color:'#666' }}>{l.transport}</td>
                  <td style={{ padding:'12px 10px', fontSize:11, color:'#666' }}>{l.entite}</td>
                  <td style={{ padding:'12px 10px', textAlign:'right' }}>{l.nb_lignes}</td>
                  <td style={{ padding:'12px 10px', textAlign:'right' }}>{l.qte_totale?.toLocaleString()}</td>
                  <td style={{ padding:'12px 10px', textAlign:'right', color:'#ddd' }}>{l.montant_ht?.toLocaleString('fr-FR', {minimumFractionDigits:2})} €</td>
                  <td style={{ padding:'12px 10px' }}><Badge status="Soldé" /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop:'1px solid #333' }}>
                <td colSpan={5} style={{ padding:'12px 10px', fontSize:11, color:'#555' }}>Total {livraisons.length} livraisons</td>
                <td style={{ padding:'12px 10px', textAlign:'right', fontWeight:500, color:'#ddd' }}>{livraisons.reduce((s,l)=>s+(l.qte_totale||0),0).toLocaleString()}</td>
                <td style={{ padding:'12px 10px', textAlign:'right', fontWeight:500, color:'#ff9f43' }}>{totalFA.toLocaleString('fr-FR',{minimumFractionDigits:2})} €</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Tab Reliquats */}
      {tab === 'reliquats' && (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr>
                {['','Réf BC','Fournisseur','Article','Catégorie','Commandé','Livré','Reliquat','% restant','Statut'].map((h,i) => (
                  <th key={i} style={{ textAlign: i>=5&&i<=7?'right':'left', padding:'8px 10px', color:'#444', borderBottom:'1px solid #1e1e1e', fontSize:10, textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.filter(g => g.qte_commandee - g.qte_livree > 0).map((g, gi) => {
                const key = `rel-${g.bc}-${g.ref}-${g.produit}`
                const isOpen = expanded.has(key)
                const rel = g.qte_commandee - g.qte_livree
                const pct = Math.round(rel / g.qte_commandee * 100)
                const st = getStatus(g.qte_commandee, g.qte_livree, g.livraison_prevue)
                const hasMultiple = g.rows.length > 1
                const relRows = g.rows.filter(r => r.qte_commandee - r.qte_livree > 0)
                return [
                  <tr key={key} onClick={() => hasMultiple && toggleExpand(key)}
                    style={{ borderBottom: isOpen ? '1px solid #2a2a2a' : '1px solid #1a1a1a', cursor: hasMultiple?'pointer':'default', background: isOpen?'#181818':'transparent' }}
                    onMouseEnter={e => { if(!isOpen) e.currentTarget.style.background='#161616' }}
                    onMouseLeave={e => { if(!isOpen) e.currentTarget.style.background='transparent' }}>
                    <td style={{ padding:'10px 8px', width:20, color:'#444', fontSize:12 }}>
                      {hasMultiple ? (isOpen ? '▾' : '▸') : ''}
                    </td>
                    <td style={{ padding:'10px 10px' }}>
                      <div style={{ fontWeight:600, color:'#fff', fontSize:13 }}>{g.bc}</div>
                      <div style={{ fontSize:10, color:'#444', marginTop:2 }}>{g.ref}</div>
                    </td>
                    <td style={{ padding:'10px 10px', fontSize:11, color:'#555' }}>{g.fournisseur}</td>
                    <td style={{ padding:'10px 10px' }}>
                      <div style={{ fontWeight:500, color:'#ddd' }}>{g.produit}</div>
                      {hasMultiple && <div style={{ fontSize:10, color:'#444', marginTop:2 }}>{relRows.length} tailles en reliquat</div>}
                    </td>
                    <td style={{ padding:'10px 10px' }}><span style={{ fontSize:10, color:'#555', background:'#1c1c1c', border:'1px solid #2a2a2a', padding:'2px 7px', borderRadius:10 }}>{g.categorie}</span></td>
                    <td style={{ padding:'10px 10px', textAlign:'right' }}>{g.qte_commandee}</td>
                    <td style={{ padding:'10px 10px', textAlign:'right' }}>{g.qte_livree}</td>
                    <td style={{ padding:'10px 10px', textAlign:'right', fontWeight:500, color:'#ff9f43' }}>{rel}</td>
                    <td style={{ padding:'10px 10px', textAlign:'right', color:'#555' }}>{pct}%</td>
                    <td style={{ padding:'10px 10px' }}><Badge status={st} /></td>
                  </tr>,
                  ...(isOpen ? relRows.map((r, ri) => {
                    const rrel = r.qte_commandee - r.qte_livree
                    const rpct = Math.round(rrel / r.qte_commandee * 100)
                    return (
                      <tr key={`${key}-${ri}`} style={{ borderBottom:'1px solid #141414', background:'#141414' }}>
                        <td style={{ padding:'7px 8px' }} />
                        <td style={{ padding:'7px 10px' }} />
                        <td style={{ padding:'7px 10px' }} />
                        <td style={{ padding:'7px 10px 7px 20px' }}><div style={{ fontSize:12, color:'#888' }}>↳ {r.taille || '—'}</div></td>
                        <td style={{ padding:'7px 10px' }} />
                        <td style={{ padding:'7px 10px', textAlign:'right', fontSize:12, color:'#777' }}>{r.qte_commandee}</td>
                        <td style={{ padding:'7px 10px', textAlign:'right', fontSize:12, color:'#777' }}>{r.qte_livree}</td>
                        <td style={{ padding:'7px 10px', textAlign:'right', fontSize:12, fontWeight:500, color:'#cc7a30' }}>{rrel}</td>
                        <td style={{ padding:'7px 10px', textAlign:'right', fontSize:12, color:'#555' }}>{rpct}%</td>
                        <td style={{ padding:'7px 10px' }}><Badge status={getStatus(r.qte_commandee, r.qte_livree, r.livraison_prevue)} /></td>
                      </tr>
                    )
                  }) : [])
                ]
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop:'1px solid #333' }}>
                <td colSpan={7} style={{ padding:'12px 10px', fontSize:11, color:'#555' }}>Total reliquat</td>
                <td style={{ padding:'12px 10px', textAlign:'right', fontWeight:500, color:'#ff9f43' }}>{totalRel.toLocaleString()}</td>
                <td colSpan={2} style={{ padding:'12px 10px', textAlign:'right', fontSize:11, color:'#ff9f43' }}>{valRel > 0 ? `${Math.round(valRel).toLocaleString('fr-FR')} € est.` : ''}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
