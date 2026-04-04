import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { SEED_COMMANDES } from './lib/seedData'
import { SEED_LIVRAISONS, ENGAGEMENTS } from './lib/livraisonsData'
import './App.css'

const STATUT_LIVRAISON = {
  'Proformé':              { icon:'📋', color:'#4a9eff', bg:'#0a1a2b', border:'#102840' },
  'En route':              { icon:'🚚', color:'#ff9f43', bg:'#2b1e0a', border:'#4a3010' },
  'En cours de vérification': { icon:'🔍', color:'#f9ca24', bg:'#2b2a0a', border:'#4a4010' },
  'Received':           { icon:'✅', color:'#2ed573', bg:'#0d2b1a', border:'#1a4a2a' },
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
        {pLiv}% received{pEng > pLiv ? ` · ${pEng}% engagé` : ''}
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

export default function App() {
  const [commandes, setCommandes] = useState([])
  const [livraisons, setLivraisons] = useState([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [tab, setTab] = useState('orders')
  const [search, setSearch] = useState('')
  const [filtCat, setFiltCat] = useState('all')
  const [filtStatus, setFiltStatus] = useState('all')
  const [expanded, setExpanded] = useState(new Set())

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
    const matchSt = filtStatus === 'all' ||
      (filtStatus === 'Soldé' && rel <= 0) ||
      (filtStatus === 'In Transit' && rel > 0 && vraiReliquat === 0) ||
      (filtStatus === 'Partiel' && vraiReliquat > 0 && c.qte_livree > 0) ||
      (filtStatus === 'Ouvert' && vraiReliquat > 0 && c.qte_livree === 0)
    return matchSearch && matchCat && matchSt
  })

  const groups = groupByModel(filtered, engMap)
  const cats = [...new Set(commandes.map(c => c.categorie))]

  const totalCmd = filtered.reduce((s,c)=>s+c.qte_commandee,0)
  const totalLiv = filtered.reduce((s,c)=>s+c.qte_livree,0)
  const seenEng = new Set()
  const totalEng = filtered.reduce((s,r)=>{const k=`${r.ref}||${r.taille}`;if(seenEng.has(k))return s;seenEng.add(k);return s+(engMap[k]||0)},0)
  const totalReliquat = Math.max(0, totalCmd - totalLiv - totalEng)
  const totalFA = livraisons.filter(l=>l.statut==='Réceptionné'||l.statut==='En cours de vérification').reduce((s,l)=>s+(l.montant_ht||0),0)
  const totalEnRoute = livraisons.filter(l=>l.statut==='En route'||l.statut==='En cours de vérification').reduce((s,l)=>s+(l.montant_ht||0),0)
  const totalProforma = livraisons.filter(l=>l.statut==='Proformé').reduce((s,l)=>s+(l.montant_ht||0),0)
  const totalAllLivraisons = totalFA + totalEnRoute + totalProforma

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
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:10}}>
        <div>
          <div style={{fontSize:20,fontWeight:500,color:'#fff'}}>Supplier Order Tracking</div>
          <div style={{fontSize:12,color:'#444',marginTop:3}}>Circular Stream SL · F.one · Season SS26</div>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          <select value={filtStatus} onChange={e=>setFiltStatus(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="Soldé">Soldé</option>
            <option value="In Transit">In Transit (reliquat couvert)</option>
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
          {label:'Invoiced / Verified', value:`${totalFA.toLocaleString('fr-FR',{maximumFractionDigits:0})} €`, color:'#2ed573'},
          {label:'In Transit / Verification', value:`${totalEnRoute.toLocaleString('fr-FR',{maximumFractionDigits:0})} €`, color:'#f9ca24'},
          {label:'Proforma (Upcoming)', value:`${totalProforma.toLocaleString('fr-FR',{maximumFractionDigits:0})} €`, color:'#4a9eff'},
          {label:'True Remaining Backlog', value:`${(totalEnRoute+totalProforma).toLocaleString('fr-FR',{maximumFractionDigits:0})} €`, color:(totalEnRoute+totalProforma)>0?'#ff4757':'#2ed573'},
        ].map(m=>(
          <div key={m.label} style={{background:'#1c1c1c',borderRadius:10,padding:'14px 16px',border:'1px solid #222',flex:1,minWidth:150}}>
            <div style={{fontSize:11,color:'#555',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>{m.label}</div>
            <div style={{fontSize:20,fontWeight:500,color:m.color}}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:'flex',borderBottom:'1px solid #222',marginBottom:16}}>
        {['orders','deliveries','backlog','pre-orders','financial'].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{padding:'9px 18px',fontSize:13,cursor:'pointer',background:'none',border:'none',borderBottom:tab===t?'2px solid #fff':'2px solid transparent',color:tab===t?'#fff':'#555',textTransform:'capitalize'}}>
            {t}
            {t==='livraisons'&&<span style={{display:'inline-block',width:6,height:6,background:'#ff9f43',borderRadius:'50%',marginLeft:5,verticalAlign:'middle'}}/>}
          </button>
        ))}
      </div>

      {/* Tab Commandes */}
      {tab==='orders'&&(
        <>
          <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search item / ref. / PO..." style={{flex:1,minWidth:200}}/>
          </div>
          <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:14}}>
            {['all',...cats].map(c=>(
              <button key={c} onClick={()=>setFiltCat(c)} style={{padding:'4px 11px',borderRadius:20,fontSize:11,cursor:'pointer',border:`1px solid ${filtCat===c?'#555':'#333'}`,background:filtCat===c?'#2a2a2a':'transparent',color:filtCat===c?'#ddd':'#555'}}>
                {c==='all'?'All':c}
              </button>
            ))}
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr>{['','PO Ref','Supplier','Item','Category','Ordered','Received','In Transit','True Backlog','Progress'].map((h,i)=>(
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
      {tab==='deliveries'&&(
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr>{['Réf','Type','Date prévu','Entité','Qté','Montant HT','Status','Notes'].map((h,i)=>(
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
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{borderTop:'1px solid #333'}}>
                <td colSpan={4} style={{padding:'12px 10px',fontSize:11,color:'#555'}}>Total {livraisons.length} mouvements</td>
                <td style={{padding:'12px 10px',textAlign:'right',color:'#ddd'}}>{livraisons.reduce((s,l)=>s+(l.qte_totale||0),0).toLocaleString()}</td>
                <td style={{padding:'12px 10px',textAlign:'right',color:'#ff9f43'}}>{livraisons.reduce((s,l)=>s+(l.montant_ht||0),0).toLocaleString('fr-FR',{minimumFractionDigits:2})} €</td>
                <td colSpan={2}/>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Tab Backlog */}
      {tab==='backlog'&&(
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr>{['','PO Ref','Item','Category','Ordered','Received','In Transit','True Backlog'].map((h,i)=>(
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
                <td colSpan={7} style={{padding:'12px 10px',fontSize:11,color:'#555'}}>True Backlog total (hors engagements)</td>
                <td style={{padding:'12px 10px',textAlign:'right',fontWeight:500,color:'#ff4757'}}>{totalReliquat.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {tab==='pre-orders' && (
        <div>
          <div style={{marginBottom:16,color:'#888',fontSize:13}}>Pre-order fulfillment by category - SS26</div>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr style={{borderBottom:'1px solid #333',color:'#888'}}>
                <th style={{textAlign:'left',padding:'8px 10px'}}>Category</th>
                <th style={{textAlign:'right',padding:'8px 10px'}}>Ordered</th>
                <th style={{textAlign:'right',padding:'8px 10px'}}>Received</th>
                <th style={{textAlign:'right',padding:'8px 10px'}}>In Transit</th>
                <th style={{textAlign:'right',padding:'8px 10px'}}>Remaining</th>
                <th style={{padding:'8px 10px',minWidth:140}}>Fulfillment</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(
                commandes.reduce((acc,r)=>{
                  const cat=r.categorie||'Other'
                  if(!acc[cat]) acc[cat]={cmd:0,liv:0,eng:0}
                  acc[cat].cmd+=(r.qte_commandee||0)
                  acc[cat].liv+=(r.qte_livree||0)
                  acc[cat].eng+=(engMap[`${r.ref}||${r.taille}`]||0)
                  return acc
                },{})
              ).sort(([a],[b])=>a.localeCompare(b)).map(([cat,g])=>{
                const remaining=Math.max(0,g.cmd-g.liv-g.eng)
                const pct=g.cmd>0?Math.round((g.liv/g.cmd)*100):0
                return (
                  <tr key={cat} style={{borderBottom:'1px solid #1a1a1a'}}>
                    <td style={{padding:'10px',fontWeight:500}}>{cat}</td>
                    <td style={{padding:'10px',textAlign:'right'}}>{g.cmd.toLocaleString()}</td>
                    <td style={{padding:'10px',textAlign:'right',color:'#2ed573'}}>{g.liv.toLocaleString()}</td>
                    <td style={{padding:'10px',textAlign:'right',color:'#ff9f43'}}>{g.eng.toLocaleString()}</td>
                    <td style={{padding:'10px',textAlign:'right',color:'#ff4757'}}>{remaining.toLocaleString()}</td>
                    <td style={{padding:'10px'}}>
                      <div style={{background:'#222',borderRadius:4,height:8,overflow:'hidden'}}>
                        <div style={{background:'#2ed573',height:'100%',width:pct+'%'}}/>
                      </div>
                      <span style={{fontSize:11,color:'#888',marginTop:3,display:'block'}}>{pct}% received</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{borderTop:'1px solid #333'}}>
                <td style={{padding:'12px 10px',fontWeight:600}}>TOTAL</td>
                <td style={{padding:'12px 10px',textAlign:'right',fontWeight:600}}>{totalCmd.toLocaleString()}</td>
                <td style={{padding:'12px 10px',textAlign:'right',fontWeight:600,color:'#2ed573'}}>{totalLiv.toLocaleString()}</td>
                <td style={{padding:'12px 10px',textAlign:'right',fontWeight:600,color:'#ff9f43'}}>{totalEng.toLocaleString()}</td>
                <td style={{padding:'12px 10px',textAlign:'right',fontWeight:600,color:'#ff4757'}}>{totalReliquat.toLocaleString()}</td>
                <td/>
              </tr>
            </tfoot>
          </table>
        </div>
      {tab==='financial' && (
        <div>
          <div style={{marginBottom:16,color:'#888',fontSize:13}}>Financial summary - F-ONE SS26 order</div>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr style={{borderBottom:'1px solid #333',color:'#888'}}>
                <th style={{textAlign:'left',padding:'8px 10px'}}>Line item</th>
                <th style={{textAlign:'right',padding:'8px 10px'}}>Amount</th>
                <th style={{textAlign:'right',padding:'8px 10px'}}>Share</th>
                <th style={{padding:'8px 10px',minWidth:160}}>Progress</th>
              </tr>
            </thead>
            <tbody>
              {[
                {label:'Invoiced / Received',amount:totalFA,color:'#2ed573'},
                {label:'In Transit',amount:totalEnRoute,color:'#ff9f43'},
                {label:'Proforma (Upcoming)',amount:totalProforma,color:'#4a9eff'},
              ].map(row => {
                const pct = totalAllLivraisons > 0 ? Math.round((row.amount/totalAllLivraisons)*100) : 0
                return (
                  <tr key={row.label} style={{borderBottom:'1px solid #1a1a1a'}}>
                    <td style={{padding:'10px',fontWeight:500}}>{row.label}</td>
                    <td style={{padding:'10px',textAlign:'right',color:row.color}}>{row.amount.toLocaleString('fr-FR',{maximumFractionDigits:0})} €</td>
                    <td style={{padding:'10px',textAlign:'right',color:'#888'}}>{pct}%</td>
                    <td style={{padding:'10px'}}>
                      <div style={{background:'#222',borderRadius:4,height:8,overflow:'hidden'}}>
                        <div style={{background:row.color,height:'100%',width:pct+'%'}}/>
                      </div>
                    </td>
                  </tr>
                )
              })}
              <tr style={{borderBottom:'1px solid #1a1a1a'}}>
                <td style={{padding:'10px',fontWeight:500,color:'#ff4757'}}>Backlog (not yet invoiced)</td>
                <td style={{padding:'10px',textAlign:'right',color:'#ff4757'}}>-</td>
                <td style={{padding:'10px',textAlign:'right',color:'#888'}}>-</td>
                <td style={{padding:'10px',color:'#888',fontSize:11}}>{totalReliquat.toLocaleString()} units pending</td>
              </tr>
            </tbody>
            <tfoot>
              <tr style={{borderTop:'1px solid #333'}}>
                <td style={{padding:'12px 10px',fontWeight:600}}>TOTAL DOCUMENTED</td>
                <td style={{padding:'12px 10px',textAlign:'right',fontWeight:600}}>{totalAllLivraisons.toLocaleString('fr-FR',{maximumFractionDigits:0})} €</td>
                <td style={{padding:'12px 10px',textAlign:'right',fontWeight:600}}>100%</td>
                <td/>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
