import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { SEED_COMMANDES, SEED_LIVRAISONS } from './lib/seedData'
import './App.css'

const TODAY = new Date('2026-03-16')

function getStatus(row) {
  const rel = row.qte_commandee - row.qte_livree
  if (rel <= 0) return 'Soldé'
  const prev = new Date(row.livraison_prevue)
  if (prev < TODAY && rel > 0) return 'Retard'
  if (row.qte_livree === 0) return 'Ouvert'
  return 'Partiel'
}

function Badge({ status }) {
  const styles = {
    Soldé: { bg: '#0d2b1a', color: '#2ed573', border: '#1a4a2a' },
    Partiel: { bg: '#2b1e0a', color: '#ff9f43', border: '#4a3010' },
    Ouvert: { bg: '#0a1a2b', color: '#4a9eff', border: '#102840' },
    Retard: { bg: '#2b0a0a', color: '#ff4757', border: '#4a1010' },
  }
  const s = styles[status] || styles.Ouvert
  return (
    <span style={{
      display: 'inline-block', padding: '3px 9px', borderRadius: 20,
      fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap',
      background: s.bg, color: s.color, border: `1px solid ${s.border}`
    }}>{status}</span>
  )
}

function ProgressBar({ liv, cmd }) {
  const pct = cmd > 0 ? Math.round(liv / cmd * 100) : 0
  const color = pct === 100 ? '#2ed573' : pct > 50 ? '#ff9f43' : '#ff4757'
  return (
    <div style={{ minWidth: 90 }}>
      <div style={{ height: 5, background: '#222', borderRadius: 3, marginBottom: 3 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3 }} />
      </div>
      <div style={{ fontSize: 10, color: '#555' }}>{pct}%</div>
    </div>
  )
}

function MetricCard({ label, value, color = '#fff' }) {
  return (
    <div style={{
      background: '#1c1c1c', borderRadius: 10, padding: '14px 16px',
      border: '1px solid #222', flex: 1, minWidth: 140
    }}>
      <div style={{ fontSize: 11, color: '#555', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 500, color }}>{value}</div>
    </div>
  )
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
  const [filtFournisseur, setFiltFournisseur] = useState('all')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: cmds }, { data: livs }] = await Promise.all([
      supabase.from('commandes').select('*').order('bc'),
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

  const cats = [...new Set(commandes.map(c => c.categorie))]

  const filtered = commandes.filter(c => {
    const st = getStatus(c)
    const matchSearch = !search ||
      c.produit?.toLowerCase().includes(search.toLowerCase()) ||
      c.ref?.toLowerCase().includes(search.toLowerCase()) ||
      c.bc?.toLowerCase().includes(search.toLowerCase())
    return (
      matchSearch &&
      (filtCat === 'all' || c.categorie === filtCat) &&
      (filtStatut === 'all' || st === filtStatut) &&
      (filtFournisseur === 'all' || c.fournisseur === filtFournisseur)
    )
  })

  const totalCmd = filtered.reduce((s, c) => s + (c.qte_commandee || 0), 0)
  const totalLiv = filtered.reduce((s, c) => s + (c.qte_livree || 0), 0)
  const totalRel = totalCmd - totalLiv
  const valRel = filtered.reduce((s, c) => s + (c.qte_commandee - c.qte_livree) * (c.prix_u || 0), 0)
  const retards = filtered.filter(c => getStatus(c) === 'Retard').length
  const actives = filtered.filter(c => getStatus(c) !== 'Soldé').length
  const totalFA = livraisons.reduce((s, l) => s + (l.montant_ht || 0), 0)

  const reliquats = filtered.filter(c => c.qte_commandee - c.qte_livree > 0)
  const totRelQ = reliquats.reduce((s, c) => s + (c.qte_commandee - c.qte_livree), 0)
  const totRelV = reliquats.reduce((s, c) => s + (c.qte_commandee - c.qte_livree) * (c.prix_u || 0), 0)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#555' }}>
      Chargement...
    </div>
  )

  if (commandes.length === 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16 }}>
      <div style={{ color: '#888', fontSize: 15 }}>Base de données vide — importer les données SS26 ?</div>
      <button onClick={seedDatabase} disabled={seeding} style={{
        background: '#e8e8e8', color: '#111', border: 'none', borderRadius: 8,
        padding: '10px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer'
      }}>
        {seeding ? 'Import en cours...' : '⬆ Importer données SS26'}
      </button>
    </div>
  )

  return (
    <div style={{ padding: '20px 28px', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 500, color: '#fff' }}>Suivi commandes fournisseurs</div>
          <div style={{ fontSize: 12, color: '#444', marginTop: 3 }}>Circular Stream SL · F.one · Saison SS26</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={filtFournisseur} onChange={e => setFiltFournisseur(e.target.value)}>
            <option value="all">Tous fournisseurs</option>
            {[...new Set(commandes.map(c => c.fournisseur))].map(f => <option key={f}>{f}</option>)}
          </select>
          <select value={filtStatut} onChange={e => setFiltStatut(e.target.value)}>
            <option value="all">Tous statuts</option>
            {['Soldé','Partiel','Ouvert','Retard'].map(s => <option key={s}>{s}</option>)}
          </select>
          <button onClick={seedDatabase} style={{
            background: '#2a2a2a', color: '#888', border: '1px solid #333',
            borderRadius: 8, padding: '7px 12px', fontSize: 12, cursor: 'pointer'
          }}>↺ Reseed</button>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <MetricCard label="Commandes actives" value={actives} color="#4a9eff" />
        <MetricCard label="Unités en reliquat" value={totalRel.toLocaleString()} color="#ff9f43" />
        <MetricCard label="Valeur reliquat" value={`${Math.round(valRel).toLocaleString('fr-FR')} €`} color="#ff9f43" />
        <MetricCard label="Alertes retard" value={retards} color={retards > 0 ? '#ff4757' : '#2ed573'} />
        <MetricCard label="Facturé HT" value={`${totalFA.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`} color="#fff" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #222', marginBottom: 16 }}>
        {['commandes', 'livraisons', 'reliquats'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '9px 18px', fontSize: 13, cursor: 'pointer', background: 'none', border: 'none',
            borderBottom: tab === t ? '2px solid #fff' : '2px solid transparent',
            color: tab === t ? '#fff' : '#555', transition: 'all 0.15s', textTransform: 'capitalize'
          }}>
            {t}
            {t === 'livraisons' && <span style={{ display: 'inline-block', width: 6, height: 6, background: '#ff4757', borderRadius: '50%', marginLeft: 5, verticalAlign: 'middle' }} />}
          </button>
        ))}
      </div>

      {/* Tab: Commandes */}
      {tab === 'commandes' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher article / réf. / BC..."
              style={{ flex: 1, minWidth: 200 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 14 }}>
            {['all', ...cats].map(c => (
              <button key={c} onClick={() => setFiltCat(c)} style={{
                padding: '4px 11px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
                border: `1px solid ${filtCat === c ? '#555' : '#333'}`,
                background: filtCat === c ? '#2a2a2a' : 'transparent',
                color: filtCat === c ? '#ddd' : '#555'
              }}>{c === 'all' ? 'Toutes' : c}</button>
            ))}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Réf BC', 'Fournisseur', 'Article / Taille', 'Catégorie', 'Commandé', 'Livré', 'Reliquat', 'Avancement', 'Statut', 'Livraison prévue'].map(h => (
                    <th key={h} style={{ textAlign: h.match(/Commandé|Livré|Reliquat/) ? 'right' : 'left', padding: '8px 10px', color: '#444', borderBottom: '1px solid #1e1e1e', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => {
                  const rel = c.qte_commandee - c.qte_livree
                  const st = getStatus(c)
                  const late = st === 'Retard'
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #1a1a1a' }} onMouseEnter={e => e.currentTarget.style.background='#161616'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <td style={{ padding: '10px 10px' }}>
                        <div style={{ fontWeight: 600, color: '#fff', fontSize: 13 }}>{c.bc}</div>
                        <div style={{ fontSize: 10, color: '#444', marginTop: 2 }}>{c.ref}</div>
                      </td>
                      <td style={{ padding: '10px 10px', fontSize: 11, color: '#555' }}>{c.fournisseur}</td>
                      <td style={{ padding: '10px 10px' }}>
                        <div style={{ fontWeight: 500, color: '#ddd', fontSize: 13 }}>{c.produit}</div>
                        {c.taille && <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>{c.taille}</div>}
                      </td>
                      <td style={{ padding: '10px 10px' }}>
                        <span style={{ fontSize: 10, color: '#555', background: '#1c1c1c', border: '1px solid #2a2a2a', padding: '2px 7px', borderRadius: 10 }}>{c.categorie}</span>
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.qte_commandee}</td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.qte_livree}</td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: rel > 0 ? 500 : 400, color: rel > 0 ? '#ff9f43' : '#2ed573', fontVariantNumeric: 'tabular-nums' }}>{rel}</td>
                      <td style={{ padding: '10px 10px' }}><ProgressBar liv={c.qte_livree} cmd={c.qte_commandee} /></td>
                      <td style={{ padding: '10px 10px' }}><Badge status={st} /></td>
                      <td style={{ padding: '10px 10px', fontSize: 11, color: late ? '#ff4757' : '#555', whiteSpace: 'nowrap' }}>
                        {c.livraison_prevue ? new Date(c.livraison_prevue).toLocaleDateString('fr-FR') : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Tab: Livraisons */}
      {tab === 'livraisons' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Facture', 'Date livraison', 'Transport', 'Entité', 'Lignes', 'Qté', 'Montant HT', 'Statut'].map(h => (
                  <th key={h} style={{ textAlign: h.match(/Lignes|Qté|Montant/) ? 'right' : 'left', padding: '8px 10px', color: '#444', borderBottom: '1px solid #1e1e1e', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {livraisons.map((l, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #1a1a1a' }}>
                  <td style={{ padding: '12px 10px', fontWeight: 600, color: '#fff', fontFamily: 'monospace', fontSize: 13 }}>{l.facture}</td>
                  <td style={{ padding: '12px 10px', fontSize: 11, color: '#888' }}>{new Date(l.date_livraison).toLocaleDateString('fr-FR')}</td>
                  <td style={{ padding: '12px 10px', fontSize: 11, color: '#666' }}>{l.transport}</td>
                  <td style={{ padding: '12px 10px', fontSize: 11, color: '#666' }}>{l.entite}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'right' }}>{l.nb_lignes}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'right' }}>{l.qte_totale?.toLocaleString()}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'right', color: '#ddd', fontVariantNumeric: 'tabular-nums' }}>{l.montant_ht?.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</td>
                  <td style={{ padding: '12px 10px' }}><Badge status="Soldé" /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '1px solid #333' }}>
                <td colSpan={5} style={{ padding: '12px 10px', fontSize: 11, color: '#555' }}>Total {livraisons.length} livraisons</td>
                <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 500, color: '#ddd' }}>{livraisons.reduce((s, l) => s + (l.qte_totale || 0), 0).toLocaleString()}</td>
                <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 500, color: '#ff9f43' }}>{totalFA.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Tab: Reliquats */}
      {tab === 'reliquats' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Réf BC', 'Fournisseur', 'Article / Taille', 'Catégorie', 'Commandé', 'Livré', 'Reliquat', '% restant', 'Statut'].map(h => (
                  <th key={h} style={{ textAlign: h.match(/Commandé|Livré|Reliquat|%/) ? 'right' : 'left', padding: '8px 10px', color: '#444', borderBottom: '1px solid #1e1e1e', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reliquats.map((c, i) => {
                const rel = c.qte_commandee - c.qte_livree
                const pct = Math.round(rel / c.qte_commandee * 100)
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <td style={{ padding: '10px 10px' }}>
                      <div style={{ fontWeight: 600, color: '#fff', fontSize: 13 }}>{c.bc}</div>
                      <div style={{ fontSize: 10, color: '#444', marginTop: 2 }}>{c.ref}</div>
                    </td>
                    <td style={{ padding: '10px 10px', fontSize: 11, color: '#555' }}>{c.fournisseur}</td>
                    <td style={{ padding: '10px 10px' }}>
                      <div style={{ fontWeight: 500, color: '#ddd' }}>{c.produit}</div>
                      {c.taille && <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>{c.taille}</div>}
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      <span style={{ fontSize: 10, color: '#555', background: '#1c1c1c', border: '1px solid #2a2a2a', padding: '2px 7px', borderRadius: 10 }}>{c.categorie}</span>
                    </td>
                    <td style={{ padding: '10px 10px', textAlign: 'right' }}>{c.qte_commandee}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right' }}>{c.qte_livree}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 500, color: '#ff9f43' }}>{rel}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', color: '#555' }}>{pct}%</td>
                    <td style={{ padding: '10px 10px' }}><Badge status={getStatus(c)} /></td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '1px solid #333' }}>
                <td colSpan={6} style={{ padding: '12px 10px', fontSize: 11, color: '#555' }}>Total reliquat — {reliquats.length} lignes</td>
                <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 500, color: '#ff9f43' }}>{totRelQ.toLocaleString()}</td>
                <td style={{ padding: '12px 10px', textAlign: 'right', fontSize: 11, color: '#ff9f43' }}>{totRelV > 0 ? `${Math.round(totRelV).toLocaleString('fr-FR')} € est.` : ''}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
