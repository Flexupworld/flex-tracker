// Livraisons et proformas â Circular Stream SL / F.one SS26

export const SEED_LIVRAISONS = [
  // ââ RÃCEPTIONNÃES âââââââââââââââââââââââââââââââââââââââââââââ
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
    statut: 'En cours de vÃ©rification',
    saison: 'SS26',
    notes: 'ArrivÃ©e aujourd\'hui â vÃ©rification en cours'
  },
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
  // ââ PROFORMAS ACCEPTÃES â EN ATTENTE D\'EXPÃDITION âââââââââââââ
  {
    facture: 'PLF2601368',
    type: 'Proforma',
    date_emission: '2026-03-11',
    date_livraison: '2026-04-17',
    transport: 'Aucun',
    entite: 'CS_SL',
    fournisseur: 'F.one',
    nb_lignes: 1,
    qte_totale: 2,
    montant_ht: 855.00,
    statut: 'ProformÃ©',
    saison: 'SS26',
    notes: 'HM CARBON MAST 14 - 75cm Ã2'
  },
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
    statut: 'ProformÃ©',
    saison: 'SS26',
    notes: 'Handles, Boom, FW, Tails, Foils, ALU Masts, Swing V5'
  },
  {
    facture: 'PLE2600580',
    type: 'Proforma',
    date_emission: '2026-03-11',
    date_livraison: '2026-03-06',
    transport: 'Aucun',
    entite: 'CS_SL',
    fournisseur: 'F.one',
    nb_lignes: 17,
    qte_totale: 57,
    montant_ht: 30537.41,
    statut: 'ProformÃ©',
    saison: 'SS26',
    notes: 'Rocket Free Surf, Rocket Wing -S, Rocket Free DW, Rocket Wing Carbon'
  },
]

// QuantitÃ©s engagÃ©es par ref+taille (proformas + en route + en vÃ©rification)
// Ces qtÃ©s s'ajoutent aux qte_livree pour calculer le vrai reliquat
export const ENGAGEMENTS = [
  // PLF2601368 — Proformé (not yet shipped)
  { facture:'PLF2601368', ref:'77267-0710', produit:'HM CARBON MAST 14', taille:'75cm', qte:2, statut:'Proformé' },

  // FAE2600481 — En route (ex-PLE2600580, real invoice number confirmed)
  { facture:'FAE2600481', ref:'77268-1303', produit:'ROCKET FREE SURF', taille:"5'2", qte:2, statut:'En route' },
  { facture:'FAE2600481', ref:'77268-1303', produit:'ROCKET FREE SURF', taille:"5'5", qte:2, statut:'En route' },
  { facture:'FAE2600481', ref:'77268-1303', produit:'ROCKET FREE SURF', taille:"5'8", qte:2, statut:'En route' },
  { facture:'FAE2600481', ref:'77268-1303', produit:'ROCKET FREE SURF', taille:"5'11", qte:5, statut:'En route' },
  { facture:'FAE2600481', ref:'77268-1303', produit:'ROCKET FREE SURF', taille:"6'2", qte:5, statut:'En route' },
  { facture:'FAE2600481', ref:'77268-1303', produit:'ROCKET FREE SURF', taille:"6'5", qte:5, statut:'En route' },
  { facture:'FAE2600481', ref:'77268-1303', produit:'ROCKET FREE SURF', taille:"6'8", qte:5, statut:'En route' },
  { facture:'FAE2600481', ref:'77248-0502', produit:'ROCKET WING CARBON', taille:"4'6", qte:1, statut:'En route' },
  { facture:'FAE2600481', ref:'77268-0601', produit:'ROCKET WING - S', taille:"5'0", qte:5, statut:'En route' },
  { facture:'FAE2600481', ref:'77268-0601', produit:'ROCKET WING - S', taille:"5'3", qte:6, statut:'En route' },
  { facture:'FAE2600481', ref:'77268-0601', produit:'ROCKET WING - S', taille:"5'6", qte:5, statut:'En route' },
  { facture:'FAE2600481', ref:'77268-0601', produit:'ROCKET WING - S', taille:"5'8", qte:5, statut:'En route' },
  { facture:'FAE2600481', ref:'77268-1403', produit:'ROCKET FREE DOWNWIND', taille:"6'4", qte:3, statut:'En route' },
  { facture:'FAE2600481', ref:'77268-1403', produit:'ROCKET FREE DOWNWIND', taille:"6'8", qte:3, statut:'En route' },
  { facture:'FAE2600481', ref:'77268-1403', produit:'ROCKET FREE DOWNWIND', taille:"7'0", qte:1, statut:'En route' },
  { facture:'FAE2600481', ref:'77268-1403', produit:'ROCKET FREE DOWNWIND', taille:"7'4", qte:1, statut:'En route' },
  { facture:'FAE2600481', ref:'77268-1403', produit:'ROCKET FREE DOWNWIND', taille:"7'8", qte:1, statut:'En route' },
]
