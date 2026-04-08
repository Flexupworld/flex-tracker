// Livraisons et proformas — Circular Stream SL / F.one SS26

export const SEED_LIVRAISONS = [
  // ── RÉCEPTIONNÉES ─────────────────────────────────────────────
  {
    facture: 'FAE2600316',
    type: 'Facture',
    date_emission: '2026-03-04',
    date_livraison: '2026-03-01',
    transport: 'UPS Express Saver',
    entite: 'CS_SL',
    fournisseur: 'F.one',
    nb_lignes: 73,
    qte_totale: 442,
    montant_ht: 91302.85,
    statut: 'En cours de vérification',
    saison: 'SS26',
    notes: 'Arrivée aujourd\'hui — vérification en cours'
  },
  // ── PREMIÈRES LIVRAISONS DACHSER (pré-saison) ─────────────────
  {
    facture: 'FAE2600055',
    type: 'Facture',
    date_emission: '2026-01-14',
    date_livraison: '2026-01-15',
    transport: 'Dachser DAP Corralejo',
    entite: 'CS_SL',
    fournisseur: 'F.one',
    nb_lignes: 4,
    qte_totale: 4,
    montant_ht: 2758.61,
    statut: 'Réceptionné',
    saison: 'SS26',
    notes: 'Rocket Free Surf 5\'11 / 5\'5 / 5\'8 / 6\'2'
  },
  {
    facture: 'FAE2600056',
    type: 'Facture',
    date_emission: '2026-01-14',
    date_livraison: '2026-01-15',
    transport: 'Dachser DAP Corralejo',
    entite: 'CS_SL',
    fournisseur: 'F.one',
    nb_lignes: 4,
    qte_totale: 4,
    montant_ht: 2526.51,
    statut: 'Réceptionné',
    saison: 'SS26',
    notes: 'Rocket Free Surf 6\'5 / 6\'8 — Rocket Wing Crossover 5\'6 — Rocket Free Surf Carbon 6\'11'
  },
  // ── EN ROUTE ──────────────────────────────────────────────────
  {
    facture: 'FAE2600339',
    type: 'Facture',
    date_emission: '2026-03-09',
    date_livraison: '2026-03-02',
    transport: 'Dachser DAP Corralejo',
    entite: 'CS_SL',
    fournisseur: 'F.one',
    nb_lignes: 20,
    qte_totale: 66,
    montant_ht: 34187.12,
    statut: 'En route',
    saison: 'SS26',
    notes: 'En transit vers Corralejo'
  },
  {
    facture: 'FAE2600481',
    type: 'Facture',
    date_emission: '2026-03-25',
    date_livraison: '2026-03-06',
    transport: 'Dachser DAP Corralejo',
    entite: 'CS_SL',
    fournisseur: 'F.one',
    nb_lignes: 17,
    qte_totale: 57,
    montant_ht: 30537.41,
    statut: 'En route',
    saison: 'SS26',
    notes: 'Rocket Free Surf, Rocket Wing -S, Rocket Free DW, Rocket Wing Carbon'
  },
  // ── PROFORMAS ACCEPTÉES — EN ATTENTE D\'EXPÉDITION ─────────────
  {
    facture: 'PLE2600601',
    type: 'Proforma',
    date_emission: '2026-03-11',
    date_livraison: '2026-03-10',
    transport: 'Aucun',
    entite: 'CS_SL',
    fournisseur: 'F.one',
    nb_lignes: 28,
    qte_totale: 178,
    montant_ht: 45196.53,
    statut: 'Proformé',
    saison: 'SS26',
    notes: 'Handles, Boom, FW, Tails, Foils, ALU Masts, Swing V5'
  },
]

// Quantités engagées par ref+taille (factures en route + proformas)
// Ces qtés s'ajoutent aux qte_livree pour calculer le vrai reliquat
// FAE2600316 (reçue + vérifiée), BLE2600219 (reçue) → retirées le 2026-04-08
// PLE2600580 → devenua FAE2600481 (facture émise le 2026-03-25)
export const ENGAGEMENTS = [
  // FAE2600481 — En route (Dachser DAP Corralejo) — émise 25/03/2026
  { facture:'FAE2600481', ref:'77268-1303', produit:'ROCKET FREE SURF', taille:"5'2", qte:2, statut:'En route' },
  { facture:'FAE2600481', ref:'77268-1303', produit:'ROCKET FREE SURF', taille:"5'5", qte:2, statut:'En route' },
  { facture:'FAE2600481', ref:'77268-1303', produit:'ROCKET FREE SURF', taille:"5'8", qte:2, statut:'En route' },
  { facture:'FAE2600481', ref:'77248-0502', produit:'ROCKET WING CARBON', taille:"4'6", qte:1, statut:'En route' },
  { facture:'FAE2600481', ref:'77268-0601', produit:'ROCKET WING - S', taille:"5'0", qte:5, statut:'En route' },
  { facture:'FAE2600481', ref:'77268-0601', produit:'ROCKET WING - S', taille:"5'3", qte:6, statut:'En route' },
  { facture:'FAE2600481', ref:'77268-0601', produit:'ROCKET WING - S', taille:"5'6", qte:5, statut:'En route' },
  { facture:'FAE2600481', ref:'77268-0601', produit:'ROCKET WING - S', taille:"5'8", qte:5, statut:'En route' },
  { facture:'FAE2600481', ref:'77268-1303', produit:'ROCKET FREE SURF', taille:"5'11", qte:5, statut:'En route' },
  { facture:'FAE2600481', ref:'77268-1303', produit:'ROCKET FREE SURF', taille:"6'2", qte:5, statut:'En route' },
  { facture:'FAE2600481', ref:'77268-1303', produit:'ROCKET FREE SURF', taille:"6'5", qte:5, statut:'En route' },
  { facture:'FAE2600481', ref:'77268-1303', produit:'ROCKET FREE SURF', taille:"6'8", qte:5, statut:'En route' },
  { facture:'FAE2600481', ref:'77268-1403', produit:'ROCKET FREE DOWNWIND', taille:"6'4", qte:3, statut:'En route' },
  { facture:'FAE2600481', ref:'77268-1403', produit:'ROCKET FREE DOWNWIND', taille:"6'8", qte:3, statut:'En route' },
  { facture:'FAE2600481', ref:'77268-1403', produit:'ROCKET FREE DOWNWIND', taille:"7'0", qte:1, statut:'En route' },
  { facture:'FAE2600481', ref:'77268-1403', produit:'ROCKET FREE DOWNWIND', taille:"7'4", qte:1, statut:'En route' },
  { facture:'FAE2600481', ref:'77268-1403', produit:'ROCKET FREE DOWNWIND', taille:"7'8", qte:1, statut:'En route' },

  // FAE2600339 — Tout reçu ou non en transit — retirés le 2026-04-08
]
