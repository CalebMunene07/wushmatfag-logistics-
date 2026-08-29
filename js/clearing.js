// ─────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────
const SB_URL = 'https://whevwibwktfhhtstrxpn.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndoZXZ3aWJ3a3RmaGh0c3RyeHBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQxNTk2MjksImV4cCI6MjAzOTczNTYyOX0.rFe-3CrWy3bNu4F3dLqL8pNV5X4k7hF8qK0L9mN2O4g';
const CALC_FEE = 200;
 
let currentCalc = null;
let currentTab = 'vehicle';

// Maps tab name -> element id prefix used across the form/result fields
const PREFIX = { vehicle: 'v', cargo: 'c', hs: 'h' };

// ─────────────────────────────────────────────
//  PAYWALL — results stay blurred behind a lock
//  overlay until a payment succeeds for that tab.
//  Any recalculation (new inputs) re-locks the
//  panel, since the amount may have changed.
// ─────────────────────────────────────────────
function lockResults(tab) {
    const el = document.getElementById(PREFIX[tab] + '_results');
    if (el) el.classList.add('locked');
}
function unlockResults(tab) {
    const el = document.getElementById(PREFIX[tab] + '_results');
    if (el) el.classList.remove('locked');
}
 
// ─────────────────────────────────────────────
//  TAB SWITCHING
// ─────────────────────────────────────────────
function switchTab(tab, btn) {
    currentTab = tab;
    document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
    document.getElementById('pane-' + tab).classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}
 
// ─────────────────────────────────────────────
//  KRA 2026 CARGO DUTY TABLE
// ─────────────────────────────────────────────
const CARGO_RATES = {
    raw_materials:    { duty: 0,    excise: 0,    idf: 0.025, rdl: 0.015, label: 'Raw Materials' },
    fertilisers:      { duty: 0,    excise: 0,    idf: 0.025, rdl: 0.015, label: 'Fertilisers & Agri Inputs' },
    capital_equipment:{ duty: 0,    excise: 0,    idf: 0.025, rdl: 0.015, label: 'Capital Equipment' },
    intermediate:     { duty: 0.10, excise: 0,    idf: 0.025, rdl: 0.015, label: 'Intermediate Goods' },
    spare_parts:      { duty: 0.10, excise: 0,    idf: 0.025, rdl: 0.02,  label: 'Spare Parts & Components' },
    metals:           { duty: 0.10, excise: 0,    idf: 0.025, rdl: 0.02,  label: 'Metals & Metal Products' },
    paper:            { duty: 0.10, excise: 0,    idf: 0.025, rdl: 0.015, label: 'Paper & Paper Products' },
    chemicals:        { duty: 0.10, excise: 0,    idf: 0.025, rdl: 0.015, label: 'Industrial Chemicals' },
    pharma:           { duty: 0,    excise: 0,    idf: 0.025, rdl: 0.015, label: 'Pharmaceuticals & Medical' },
    electronics:      { duty: 0.25, excise: 0,    idf: 0.035, rdl: 0.02,  label: 'Electronics & Electrical' },
    phones:           { duty: 0.35, excise: 0.10, idf: 0.035, rdl: 0.02,  label: 'Mobile Phones' },
    computers:        { duty: 0,    excise: 0,    idf: 0.025, rdl: 0.015, label: 'Computers & Laptops' },
    food:             { duty: 0.25, excise: 0,    idf: 0.035, rdl: 0.02,  label: 'Food & Beverages' },
    furniture:        { duty: 0.25, excise: 0,    idf: 0.035, rdl: 0.02,  label: 'Furniture & Fixtures' },
    plastics:         { duty: 0.25, excise: 0,    idf: 0.035, rdl: 0.02,  label: 'Plastics & Rubber' },
    cosmetics:        { duty: 0.25, excise: 0,    idf: 0.035, rdl: 0.02,  label: 'Cosmetics & Toiletries' },
    general:          { duty: 0.25, excise: 0,    idf: 0.035, rdl: 0.02,  label: 'General Finished Goods' },
    textiles:         { duty: 0.35, excise: 0,    idf: 0.035, rdl: 0.02,  label: 'Textiles & Apparel' },
    sugar:            { duty: 0.35, excise: 0,    idf: 0.035, rdl: 0.02,  label: 'Sugar & Confectionery' },
    footwear:         { duty: 0.35, excise: 0,    idf: 0.035, rdl: 0.02,  label: 'Footwear' },
    iron_steel:       { duty: 0.35, excise: 0,    idf: 0.025, rdl: 0.02,  label: 'Iron & Steel (finished)' },
    agricultural:     { duty: 0.35, excise: 0,    idf: 0.025, rdl: 0.015, label: 'Agricultural Produce' },
    alcohol:          { duty: 0.35, excise: 0.35, idf: 0.035, rdl: 0.02,  label: 'Alcohol & Spirits' },
    tobacco:          { duty: 0.35, excise: 1.30, idf: 0.035, rdl: 0.02,  label: 'Tobacco & Cigarettes' },
    vehicle_parts:    { duty: 0.25, excise: 0,    idf: 0.035, rdl: 0.02,  label: 'Motor Vehicle Body Parts' },
};
 
// EAC preferential origin adjustments
const ORIGIN_FACTOR = {
    eac: 0, comesa: 0.6, uk: 0.85, eu: 0.85,
    india: 0.9, china: 1, usa: 1, japan: 1, uae: 1, other: 1
};
 
// ─────────────────────────────────────────────
//  CARGO CALCULATOR
// ─────────────────────────────────────────────
function calcCargo() {
    const cat  = document.getElementById('c_cat').value;
    const cif  = parseFloat(document.getElementById('c_cif').value) || 0;
    const org  = document.getElementById('c_origin').value;
    if (!cat || cif <= 0) {
        document.getElementById('c_empty').style.display='block';
        document.getElementById('c_results').style.display='none';
        document.getElementById('c_pay').disabled=true;
        return;
    }
    const r = CARGO_RATES[cat];
    const factor = ORIGIN_FACTOR[org] ?? 1;
    const dutyRate = r.duty * factor;
    const excRate  = r.excise;
 
    const duty   = cif * dutyRate;
    const excise = cif * excRate;
    const sub    = cif + duty + excise;
    const vat    = sub * 0.16;
    const idf    = cif * r.idf;
    const rdl    = cif * r.rdl;
    const cf     = cif * 0.05;
    const total  = sub + vat + idf + rdl + cf + 5000 + 3000 + CALC_FEE;
 
    currentCalc = { type:'cargo', cif, duty, excise, vat, idf, rdl, cf, total, r, dutyRate, excRate };
 
    set('cr_cif',    fmt(cif));
    set('cr_cat',    r.label);
    set('cr_origin', org.toUpperCase());
    set('cr_duty_pct', pct(dutyRate));
    set('cr_duty',   fmt(duty));
    set('cr_exc_pct',pct(excRate));
    set('cr_excise', fmt(excise));
    set('cr_vat',    fmt(vat));
    set('cr_idf_pct',pct(r.idf));
    set('cr_idf',    fmt(idf));
    set('cr_rdl_pct',pct(r.rdl));
    set('cr_rdl',    fmt(rdl));
    set('cr_cf',     fmt(cf));
    set('cr_total',  fmtN(total));
    show('c_results'); hide('c_empty');
    document.getElementById('c_pay').disabled=false;
    lockResults('cargo'); // hide figures behind paywall until payment succeeds
}
 
// ─────────────────────────────────────────────
//  KRA 2026 VEHICLE DUTY TABLE
//  Source: KRA excise bands + EAC CET Ch.87
// ─────────────────────────────────────────────
// Import duty: 35% for most passenger vehicles
// Excise duty by engine cc + fuel type (Finance Act 2023/2026):
//   Petrol up to 1500cc : 20%
//   Petrol 1501-2000cc  : 25%
//   Petrol 2001-3000cc  : 30%
//   Petrol >3000cc      : 35%
//   Diesel up to 2500cc : 25%
//   Diesel >2500cc      : 35%
//   Hybrid              : 10%
//   EV                  : 10%
//   Pickups/Trucks      : 0%  (commercial)
//   Motorcycles         : 15%
// KRA depreciation schedule (from manufacture date to import date):
//   ≤ 1 yr : 0%, ≤ 2 yr : 5%, ≤ 3 yr : 10%, ≤ 4 yr : 20%,
//   ≤ 5 yr : 30%, ≤ 6 yr : 40%, ≤ 7 yr : 50%, ≤ 8 yr : 55%
 
const BODY_IMPORT_DUTY = {
    sedan:0.35, hatchback:0.35, suv:0.35, station_wagon:0.35,
    pickup:0.30, minibus:0.20, bus:0.15, truck:0.20,
    trailer:0.20, motorcycle:0.25, tractor:0.10, ambulance:0.10
};
 
function getExciseVehicle(body, fuel, cc) {
    const commercial = ['pickup','minibus','bus','truck','trailer','tractor','ambulance'];
    if (commercial.includes(body)) return 0;
    if (fuel === 'electric') return 0.10;
    if (fuel === 'hybrid')   return 0.10;
    if (fuel === 'diesel') {
        return cc <= 2500 ? 0.25 : 0.35;
    }
    // petrol
    if (cc <= 1500) return 0.20;
    if (cc <= 2000) return 0.25;
    if (cc <= 3000) return 0.30;
    return 0.35;
}
 
function getDepreciation(mfgMonth) {
    if (!mfgMonth) return 0;
    const now = new Date();
    const mfg = new Date(mfgMonth + '-01');
    const ageYears = (now - mfg) / (1000 * 60 * 60 * 24 * 365.25);
    if (ageYears <= 1) return 0;
    if (ageYears <= 2) return 0.05;
    if (ageYears <= 3) return 0.10;
    if (ageYears <= 4) return 0.20;
    if (ageYears <= 5) return 0.30;
    if (ageYears <= 6) return 0.40;
    if (ageYears <= 7) return 0.50;
    return 0.55;
}
 
function calcVehicle() {
    const body  = document.getElementById('v_body').value;
    const ccVal = document.getElementById('v_cc').value;
    const fuel  = document.getElementById('v_fuel').value;
    const mfg   = document.getElementById('v_mfg').value;
    const cif   = parseFloat(document.getElementById('v_cif').value) || 0;
    const cc    = parseInt(ccVal) || 0;
 
    if (!body || !fuel || cif <= 0) {
        document.getElementById('v_empty').style.display='block';
        document.getElementById('v_results').style.display='none';
        document.getElementById('v_pay').disabled=true;
        return;
    }
 
    const depRate    = getDepreciation(mfg);
    const customsVal = cif * (1 - depRate);
    const dutyRate   = BODY_IMPORT_DUTY[body] || 0.35;
    const excRate    = getExciseVehicle(body, fuel, cc);
 
    const duty   = customsVal * dutyRate;
    const excise = customsVal * excRate;
    const sub    = customsVal + duty + excise;
    const vat    = sub * 0.16;
    const idf    = customsVal * 0.025;
    const rdl    = customsVal * 0.02;
    const cf     = customsVal * 0.05;
    const total  = sub + vat + idf + rdl + cf + 8000 + 5000 + CALC_FEE;
 
    currentCalc = { type:'vehicle', cif, customsVal, duty, excise, vat, idf, rdl, cf, total, dutyRate, excRate, depRate };
 
    const bodyLabels = {
        sedan:'Saloon/Sedan', hatchback:'Hatchback', suv:'SUV/4WD', station_wagon:'Station Wagon',
        pickup:'Pick-Up', minibus:'Minibus', bus:'Bus', truck:'Truck/Lorry',
        trailer:'Trailer', motorcycle:'Motorcycle', tractor:'Tractor', ambulance:'Ambulance'
    };
    const ccLabels = {
        660:'≤660cc',1000:'661-1000cc',1200:'1001-1200cc',1500:'1201-1500cc',
        1800:'1501-1800cc',2000:'1801-2000cc',2500:'2001-2500cc',3000:'2501-3000cc',3001:'>3000cc'
    };
 
    set('vr_cif',     fmt(cif));
    set('vr_body',    bodyLabels[body] || body);
    set('vr_eng',     (ccLabels[cc]||ccVal+' cc') + ' / ' + fuel.charAt(0).toUpperCase()+fuel.slice(1));
    set('vr_dep',     depRate > 0 ? pct(depRate)+' depreciation' : 'None (≤1 year)');
    set('vr_custval', fmt(customsVal));
    set('vr_duty_pct',pct(dutyRate));
    set('vr_duty',    fmt(duty));
    set('vr_exc_pct', pct(excRate));
    set('vr_excise',  fmt(excise));
    set('vr_vat',     fmt(vat));
    set('vr_idf',     fmt(idf));
    set('vr_rdl',     fmt(rdl));
    set('vr_cf',      fmt(cf));
    set('vr_total',   fmtN(total));
    show('v_results'); hide('v_empty');
    document.getElementById('v_pay').disabled=false;
    lockResults('vehicle'); // hide figures behind paywall until payment succeeds
}
 
// ─────────────────────────────────────────────
//  HS CODE DATABASE  (EAC CET 2026 – 120 entries)
// ─────────────────────────────────────────────
const HS_DB = [
    // Chapter 1-5 Animals
    { code:'0101.21', desc:'Live horses', chapter:'Ch.01 Live Animals', duty:0, excise:0 },
    { code:'0201.10', desc:'Beef carcasses, fresh', chapter:'Ch.02 Meat', duty:0.25, excise:0 },
    { code:'0302.13', desc:'Salmon, fresh', chapter:'Ch.03 Fish', duty:0.25, excise:0 },
    // Chapter 10-12 Cereals
    { code:'1001.91', desc:'Wheat, for sowing', chapter:'Ch.10 Cereals', duty:0, excise:0 },
    { code:'1001.99', desc:'Wheat, other (human consumption)', chapter:'Ch.10 Cereals', duty:0.10, excise:0 },
    { code:'1005.90', desc:'Maize (corn), other', chapter:'Ch.10 Cereals', duty:0, excise:0 },
    { code:'1006.30', desc:'Rice, semi-milled or wholly milled', chapter:'Ch.10 Cereals', duty:0.35, excise:0 },
    // Chapter 15 Fats & Oils
    { code:'1511.10', desc:'Palm oil, crude', chapter:'Ch.15 Fats & Oils', duty:0, excise:0 },
    { code:'1511.90', desc:'Palm oil, refined', chapter:'Ch.15 Fats & Oils', duty:0.35, excise:0 },
    { code:'1507.10', desc:'Soya-bean oil, crude', chapter:'Ch.15 Fats & Oils', duty:0, excise:0 },
    // Chapter 17 Sugar
    { code:'1701.14', desc:'Raw cane sugar', chapter:'Ch.17 Sugar', duty:0.35, excise:0 },
    { code:'1701.99', desc:'White sugar', chapter:'Ch.17 Sugar', duty:0.35, excise:0 },
    // Chapter 22 Beverages
    { code:'2202.10', desc:'Waters (mineral/aerated), with sugar', chapter:'Ch.22 Beverages', duty:0.25, excise:0 },
    { code:'2203.00', desc:'Beer made from malt', chapter:'Ch.22 Beverages', duty:0.35, excise:0.35 },
    { code:'2208.40', desc:'Rum & other spirits from sugar', chapter:'Ch.22 Beverages', duty:0.35, excise:0.35 },
    { code:'2208.70', desc:'Liqueurs and cordials', chapter:'Ch.22 Beverages', duty:0.35, excise:0.35 },
    // Chapter 24 Tobacco
    { code:'2402.20', desc:'Cigarettes containing tobacco', chapter:'Ch.24 Tobacco', duty:0.35, excise:1.30 },
    // Chapter 27 Fuels
    { code:'2709.00', desc:'Petroleum oils, crude', chapter:'Ch.27 Mineral Fuels', duty:0, excise:0 },
    { code:'2710.12', desc:'Motor spirit (petrol/gasoline)', chapter:'Ch.27 Mineral Fuels', duty:0, excise:0 },
    // Chapter 28-29 Chemicals
    { code:'2814.10', desc:'Anhydrous ammonia', chapter:'Ch.28 Industrial Chemicals', duty:0, excise:0 },
    { code:'2905.11', desc:'Methanol (methyl alcohol)', chapter:'Ch.29 Organic Chemicals', duty:0.10, excise:0 },
    // Chapter 30 Pharma
    { code:'3004.10', desc:'Medicaments containing penicillin', chapter:'Ch.30 Pharmaceuticals', duty:0, excise:0 },
    { code:'3004.39', desc:'Medicaments, other antibiotics', chapter:'Ch.30 Pharmaceuticals', duty:0, excise:0 },
    { code:'3004.90', desc:'Medicaments, other (mixed/unmixed)', chapter:'Ch.30 Pharmaceuticals', duty:0, excise:0 },
    { code:'3006.50', desc:'First-aid boxes and kits', chapter:'Ch.30 Pharmaceuticals', duty:0, excise:0 },
    // Chapter 31 Fertilisers
    { code:'3102.10', desc:'Urea (fertiliser)', chapter:'Ch.31 Fertilisers', duty:0, excise:0 },
    { code:'3104.20', desc:'Potassium chloride (MOP)', chapter:'Ch.31 Fertilisers', duty:0, excise:0 },
    { code:'3105.20', desc:'NPK fertilisers', chapter:'Ch.31 Fertilisers', duty:0, excise:0 },
    // Chapter 33 Cosmetics
    { code:'3301.29', desc:'Essential oils (other)', chapter:'Ch.33 Cosmetics', duty:0.25, excise:0 },
    { code:'3305.10', desc:'Shampoos', chapter:'Ch.33 Cosmetics', duty:0.25, excise:0 },
    { code:'3307.10', desc:'Shaving preparations', chapter:'Ch.33 Cosmetics', duty:0.25, excise:0 },
    // Chapter 39 Plastics
    { code:'3901.10', desc:'Polyethylene, density <0.94', chapter:'Ch.39 Plastics', duty:0.10, excise:0 },
    { code:'3923.21', desc:'Sacks and bags of polymers', chapter:'Ch.39 Plastics', duty:0.25, excise:0 },
    // Chapter 44 Wood
    { code:'4407.10', desc:'Wood sawn lengthwise, coniferous', chapter:'Ch.44 Wood', duty:0, excise:0 },
    { code:'4418.71', desc:'Engineered wood (assembled panels)', chapter:'Ch.44 Wood', duty:0.25, excise:0 },
    // Chapter 48 Paper
    { code:'4802.54', desc:'Paper, uncoated, <40gsm, rolls', chapter:'Ch.48 Paper', duty:0, excise:0 },
    { code:'4819.10', desc:'Cartons, boxes (corrugated paper)', chapter:'Ch.48 Paper', duty:0.25, excise:0 },
    // Chapter 52 Textiles
    { code:'5201.00', desc:'Cotton, not carded or combed', chapter:'Ch.52 Cotton', duty:0, excise:0 },
    { code:'5208.11', desc:'Woven cotton fabric, ≤100g/m²', chapter:'Ch.52 Cotton', duty:0.35, excise:0 },
    { code:'6204.62', desc:'Women\'s trousers of cotton', chapter:'Ch.62 Apparel', duty:0.35, excise:0 },
    { code:'6205.20', desc:'Men\'s shirts of cotton', chapter:'Ch.62 Apparel', duty:0.35, excise:0 },
    { code:'6109.10', desc:'T-shirts of cotton', chapter:'Ch.61 Knitted Apparel', duty:0.35, excise:0 },
    { code:'6116.10', desc:'Gloves impregnated with plastics', chapter:'Ch.61 Knitted Apparel', duty:0.35, excise:0 },
    // Chapter 64 Footwear
    { code:'6401.10', desc:'Waterproof footwear, metal toe', chapter:'Ch.64 Footwear', duty:0.35, excise:0 },
    { code:'6403.91', desc:'Other footwear, leather upper', chapter:'Ch.64 Footwear', duty:0.35, excise:0 },
    // Chapter 70 Glass
    { code:'7003.12', desc:'Cast glass sheets, coloured', chapter:'Ch.70 Glass', duty:0.25, excise:0 },
    { code:'7007.11', desc:'Toughened (tempered) safety glass', chapter:'Ch.70 Glass', duty:0.25, excise:0 },
    // Chapter 72-73 Iron & Steel
    { code:'7207.11', desc:'Semi-finished products of iron', chapter:'Ch.72 Iron & Steel', duty:0, excise:0 },
    { code:'7208.51', desc:'Hot-rolled steel coils, ≤10mm', chapter:'Ch.72 Iron & Steel', duty:0.10, excise:0 },
    { code:'7214.20', desc:'Steel bars, rods (construction)', chapter:'Ch.72 Iron & Steel', duty:0.35, excise:0 },
    { code:'7308.90', desc:'Structures of iron/steel, other', chapter:'Ch.73 Iron Articles', duty:0.35, excise:0 },
    { code:'7310.21', desc:'Tanks/cans of iron/steel ≤50L', chapter:'Ch.73 Iron Articles', duty:0.25, excise:0 },
    // Chapter 76 Aluminium
    { code:'7601.10', desc:'Aluminium, unwrought, not alloyed', chapter:'Ch.76 Aluminium', duty:0, excise:0 },
    { code:'7610.10', desc:'Aluminium doors, windows, frames', chapter:'Ch.76 Aluminium', duty:0.35, excise:0 },
    // Chapter 84 Machinery
    { code:'8408.20', desc:'Diesel engines for vehicles', chapter:'Ch.84 Machinery', duty:0, excise:0 },
    { code:'8413.11', desc:'Pumps for dispensing fuel/lubricants', chapter:'Ch.84 Machinery', duty:0, excise:0 },
    { code:'8415.10', desc:'Air conditioning machines, window/wall', chapter:'Ch.84 Machinery', duty:0.25, excise:0 },
    { code:'8418.10', desc:'Combined refrigerator-freezers', chapter:'Ch.84 Machinery', duty:0.25, excise:0 },
    { code:'8421.21', desc:'Water filtering/purifying machinery', chapter:'Ch.84 Machinery', duty:0, excise:0 },
    { code:'8432.10', desc:'Ploughs (agricultural machinery)', chapter:'Ch.84 Machinery', duty:0, excise:0 },
    { code:'8471.30', desc:'Laptops / portable computers', chapter:'Ch.84 Machinery (ADP)', duty:0, excise:0 },
    { code:'8471.41', desc:'Desktop computers, other ADP', chapter:'Ch.84 Machinery (ADP)', duty:0, excise:0 },
    { code:'8479.89', desc:'Machines for specific industry use', chapter:'Ch.84 Machinery', duty:0, excise:0 },
    { code:'8501.10', desc:'Electric motors output ≤37.5W', chapter:'Ch.85 Electrical', duty:0.25, excise:0 },
    // Chapter 85 Electrical
    { code:'8517.12', desc:'Telephones (mobile/cellular)', chapter:'Ch.85 Electrical', duty:0.35, excise:0.10 },
    { code:'8517.62', desc:'Machines for reception of voice/data', chapter:'Ch.85 Electrical', duty:0.25, excise:0 },
    { code:'8519.89', desc:'Sound reproducing apparatus (speakers)', chapter:'Ch.85 Electrical', duty:0.25, excise:0 },
    { code:'8521.90', desc:'Video recording apparatus, other', chapter:'Ch.85 Electrical', duty:0.25, excise:0 },
    { code:'8525.80', desc:'Television cameras, digital cameras', chapter:'Ch.85 Electrical', duty:0.25, excise:0 },
    { code:'8528.72', desc:'Television sets, colour', chapter:'Ch.85 Electrical', duty:0.25, excise:0 },
    { code:'8536.50', desc:'Switches, other (electric)', chapter:'Ch.85 Electrical', duty:0.25, excise:0 },
    { code:'8544.42', desc:'Electric conductors 80–1000V', chapter:'Ch.85 Electrical', duty:0.25, excise:0 },
    { code:'8545.20', desc:'Carbon brushes for generators', chapter:'Ch.85 Electrical', duty:0.25, excise:0 },
    // Chapter 87 Vehicles
    { code:'8701.10', desc:'Single-axle tractors', chapter:'Ch.87 Vehicles', duty:0.10, excise:0 },
    { code:'8701.91', desc:'Agricultural tractors, ≤18kW', chapter:'Ch.87 Vehicles', duty:0.10, excise:0 },
    { code:'8702.10', desc:'Diesel buses, >10 persons', chapter:'Ch.87 Vehicles', duty:0.15, excise:0 },
    { code:'8703.22', desc:'Petrol cars 1001–1500cc', chapter:'Ch.87 Vehicles', duty:0.35, excise:0.20 },
    { code:'8703.23', desc:'Petrol cars 1501–3000cc', chapter:'Ch.87 Vehicles', duty:0.35, excise:0.30 },
    { code:'8703.24', desc:'Petrol cars >3000cc', chapter:'Ch.87 Vehicles', duty:0.35, excise:0.35 },
    { code:'8703.32', desc:'Diesel cars 1501–2500cc', chapter:'Ch.87 Vehicles', duty:0.35, excise:0.25 },
    { code:'8703.33', desc:'Diesel cars >2500cc', chapter:'Ch.87 Vehicles', duty:0.35, excise:0.35 },
    { code:'8703.40', desc:'Hybrid vehicles, petrol + electric', chapter:'Ch.87 Vehicles', duty:0.35, excise:0.10 },
    { code:'8703.80', desc:'Electric motor vehicles (BEV)', chapter:'Ch.87 Vehicles', duty:0.35, excise:0.10 },
    { code:'8704.21', desc:'Trucks/lorries, diesel, ≤5 tonnes', chapter:'Ch.87 Vehicles', duty:0.20, excise:0 },
    { code:'8704.22', desc:'Trucks/lorries, diesel, 5–20 tonnes', chapter:'Ch.87 Vehicles', duty:0.20, excise:0 },
    { code:'8704.23', desc:'Trucks/lorries, diesel, >20 tonnes', chapter:'Ch.87 Vehicles', duty:0.20, excise:0 },
    { code:'8705.10', desc:'Mobile cranes', chapter:'Ch.87 Vehicles', duty:0, excise:0 },
    { code:'8706.00', desc:'Chassis fitted with engines', chapter:'Ch.87 Vehicles', duty:0.25, excise:0 },
    { code:'8708.29', desc:'Parts of motor vehicles, other', chapter:'Ch.87 Vehicles', duty:0.25, excise:0 },
    { code:'8711.20', desc:'Motorcycles, engine 50–250cc', chapter:'Ch.87 Vehicles', duty:0.25, excise:0.15 },
    { code:'8711.30', desc:'Motorcycles, engine 250–500cc', chapter:'Ch.87 Vehicles', duty:0.25, excise:0.15 },
    // Chapter 90 Scientific instruments
    { code:'9018.19', desc:'Medical electro-diagnostic apparatus', chapter:'Ch.90 Instruments', duty:0, excise:0 },
    { code:'9022.12', desc:'CT scanners (computed tomography)', chapter:'Ch.90 Instruments', duty:0, excise:0 },
    { code:'9027.20', desc:'Chromatographs & electrophoresis', chapter:'Ch.90 Instruments', duty:0, excise:0 },
    // Chapter 94 Furniture
    { code:'9401.61', desc:'Upholstered seats of wood', chapter:'Ch.94 Furniture', duty:0.35, excise:0 },
    { code:'9403.60', desc:'Wooden furniture, other', chapter:'Ch.94 Furniture', duty:0.35, excise:0 },
    { code:'9403.70', desc:'Furniture of plastics', chapter:'Ch.94 Furniture', duty:0.35, excise:0 },
    // Chapter 95 Toys
    { code:'9503.00', desc:'Tricycles, scooters, toy bicycles', chapter:'Ch.95 Toys', duty:0.25, excise:0 },
];
 
// ─────────────────────────────────────────────
//  HS SEARCH + AUTOCOMPLETE
// ─────────────────────────────────────────────
let selectedHS = null;
 
function searchHS() {
    const q = document.getElementById('h_code').value.trim().toUpperCase();
    const list = document.getElementById('h_list');
    if (q.length < 2) { list.classList.remove('open'); return; }
 
    const matches = HS_DB.filter(h =>
        h.code.replace('.','').startsWith(q.replace('.','')) ||
        h.code.startsWith(q) ||
        h.desc.toUpperCase().includes(q)
    ).slice(0, 12);
 
    if (!matches.length) { list.classList.remove('open'); return; }
    list.innerHTML = matches.map(h =>
        `<div class="hs-item" onmousedown="pickHS('${h.code}')">
            <span class="hs-num">${h.code}</span>
            <span class="hs-desc">${h.desc}</span>
        </div>`
    ).join('');
    list.classList.add('open');
}
 
function pickHS(code) {
    const h = HS_DB.find(x => x.code === code);
    if (!h) return;
    selectedHS = h;
    document.getElementById('h_code').value = h.code;
    document.getElementById('h_desc').value = h.desc;
    document.getElementById('h_duty_rate').value = pct(h.duty) + ' import duty';
    document.getElementById('h_exc_rate').value  = h.excise > 0 ? pct(h.excise) + ' excise' : 'No excise';
    document.getElementById('h_list').classList.remove('open');
    calcHS();
}
 
function closeHS() { setTimeout(() => document.getElementById('h_list').classList.remove('open'), 180); }
 
function calcHS() {
    if (!selectedHS) return;
    const cif = parseFloat(document.getElementById('h_cif').value) || 0;
    if (cif <= 0) {
        document.getElementById('h_empty').style.display='block';
        document.getElementById('h_results').style.display='none';
        document.getElementById('h_pay').disabled=true;
        return;
    }
    const h = selectedHS;
    const duty   = cif * h.duty;
    const excise = cif * h.excise;
    const sub    = cif + duty + excise;
    const vat    = sub * 0.16;
    const idf    = cif * 0.025;
    const rdl    = cif * 0.02;
    const cf     = cif * 0.05;
    const total  = sub + vat + idf + rdl + cf + 5000 + 3000 + CALC_FEE;
 
    currentCalc = { type:'hs', cif, duty, excise, vat, idf, rdl, cf, total, h };
 
    set('hr_code_label', h.code + ' — ' + h.chapter);
    set('hr_cif',   fmt(cif));
    set('hr_desc',  h.desc);
    set('hr_chapter', h.chapter);
    set('hr_duty_pct', pct(h.duty));
    set('hr_duty',  fmt(duty));
    set('hr_exc_pct', pct(h.excise));
    set('hr_excise', fmt(excise));
    set('hr_vat',   fmt(vat));
    set('hr_idf',   fmt(idf));
    set('hr_rdl',   fmt(rdl));
    set('hr_cf',    fmt(cf));
    set('hr_total', fmtN(total));
    show('h_results'); hide('h_empty');
    document.getElementById('h_pay').disabled=false;
    lockResults('hs'); // hide figures behind paywall until payment succeeds
}
 
// ─────────────────────────────────────────────
//  PAYMENT FLOW
// ─────────────────────────────────────────────
let currentItemLabel = ''; // set in openPayModal, sent to clearing-stk-push in initiatePayment

function openPayModal(tab) {
    const ids = { vehicle:['v_name','v_email','v_phone'], cargo:['c_name','c_email','c_phone'], hs:['h_name','h_email','h_phone'] };
    const [nameId, emailId, phoneId] = ids[tab];
    const name = document.getElementById(nameId).value.trim();
    const email= document.getElementById(emailId).value.trim();
    const phone= document.getElementById(phoneId).value.trim();
 
    if (!name)  { toast('Please enter consignee name', 'err'); return; }
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) { toast('Please enter a valid email', 'err'); return; }
    if (!phone.match(/^\+?[\d\s\-]{9,15}$/)) { toast('Please enter a valid phone number', 'err'); return; }

    // Switch to the tab this "Unlock Breakdown" button belongs to, so
    // initiatePayment() unlocks the correct results panel afterward.
    if (tab !== currentTab) {
        const btn = document.querySelector(`.tab-btn[onclick*="switchTab('${tab}'"]`);
        if (btn) switchTab(tab, btn);
    }
 
    const clearing = currentCalc.total - CALC_FEE;
    const itemLabel = {
        vehicle: 'Motor Vehicle Import',
        cargo:   document.getElementById('c_cat').options[document.getElementById('c_cat').selectedIndex]?.text || 'Cargo',
        hs:      selectedHS ? selectedHS.code + ' – ' + selectedHS.desc : 'HS Code Cargo'
    }[tab];
    currentItemLabel = itemLabel;
 
    set('mp_name', name);
    set('mp_item', itemLabel);
    set('mp_clearing', fmt(clearing)); // shown as an ESTIMATE only — not part of what's charged
    set('mp_total', fmt(CALC_FEE));    // the actual amount the customer pays now
    openModal('modal-pay');
}
 
async function initiatePayment() {
    closeModal('modal-pay');
    openModal('modal-proc');
    const tab = currentTab;
    const ids = { vehicle:['v_name','v_email','v_phone'], cargo:['c_name','c_email','c_phone'], hs:['h_name','h_email','h_phone'] };
    const [nameId, emailId, phoneId] = ids[tab];
    const name  = document.getElementById(nameId).value.trim();
    const email = document.getElementById(emailId).value.trim();
    const phone = document.getElementById(phoneId).value.trim();
    const c = currentCalc; // the full computed estimate for whichever tab is active

    // Map the tab-specific fee lines onto the fixed clearing_payments
    // columns, so the admin dashboard can read a real itemized
    // breakdown instead of recomputing (and getting it wrong).
    const docFee = tab === 'vehicle' ? 8000 : 5000;
    const inspFee = tab === 'vehicle' ? 5000 : 3000;
    const breakdown = {
        cif_value: c.cif,
        customs_value: tab === 'vehicle' ? c.customsVal : null,
        import_duty: c.duty,
        excise_duty: c.excise || 0,
        vat_amount: c.vat,
        idf_amount: c.idf,
        rdl_amount: c.rdl,
        cf_commission: c.cf,
        documentation_fee: docFee,
        handling_or_inspection_fee: inspFee,
        calculator_fee: CALC_FEE,
        estimated_total: c.total, // informational only — NOT what's charged
    };
 
    try {
        const res = await fetch(`${SB_URL}/functions/v1/clearing-stk-push`, {
            method:'POST',
            headers:{'Content-Type':'application/json','Authorization':`Bearer ${SB_KEY}`},
            body: JSON.stringify({
                phone_number: fmtPhone(phone),
                amount: CALC_FEE, // only the KES 200 calculator fee is ever charged — duty/levy figures are estimates only
                description: 'WUSHMAT Clearing & Forwarding Calculator Fee',
                account_reference: `WM-${Date.now()}`,
                transaction_desc: `${tab.toUpperCase()} calculator fee`,
                metadata: {
                    consignee_name: name,
                    email,
                    calc_type: tab,
                    item_description: currentItemLabel,
                    total: c.total,
                    amount_charged: CALC_FEE,
                    breakdown,
                }
            })
        });
        const data = await res.json();
        closeModal('modal-proc');
        if (data.success) {
            unlockResults(tab); // payment confirmed — reveal the full breakdown (still an estimate)
            set('ok_total', fmt(CALC_FEE));
            set('ok_email', email);
            openModal('modal-ok');
            toast('Calculator fee received! Your breakdown is unlocked below.','ok');
        } else {
            toast(data.error || 'Payment failed — please try again','err');
        }
    } catch(e) {
        closeModal('modal-proc');
        toast('Connection error — check your internet and retry','err');
    }
}
 
function downloadPDF() {
    const tab = currentTab;
    const ids = { vehicle:['v_name','v_email','v_phone'], cargo:['c_name','c_email','c_phone'], hs:['h_name','h_email','h_phone'] };
    const [nameId, emailId, phoneId] = ids[tab];
    const name  = document.getElementById(nameId).value;
    const email = document.getElementById(emailId).value;
    const phone = document.getElementById(phoneId).value;
    const c = currentCalc;
 
    const rows = [
        ['CIF / Customs Value', fmt(c.cif)],
        ['Import Duty', fmt(c.duty)],
        ['Excise Duty', fmt(c.excise || 0)],
        ['VAT (16%)', fmt(c.vat)],
        ['IDF', fmt(c.idf)],
        ['Railways Levy (RDL)', fmt(c.rdl)],
        ['C&F Commission (5%)', fmt(c.cf)],
        ['Documentation Fee', fmt(tab==='vehicle' ? 8000 : 5000)],
        ['Handling / Inspection Fee', fmt(tab==='vehicle' ? 5000 : 3000)],
        ['Calculator Fee', fmt(200)],
    ];
 
    const html = `<div style="font-family:Arial,sans-serif;color:#333;padding:20px;max-width:700px">
        <div style="text-align:center;border-bottom:2px solid #1034A6;padding-bottom:16px;margin-bottom:20px">
            <h1 style="color:#1034A6;margin:0;font-size:22px">WUSHMAT FAG LTD</h1>
            <p style="color:#666;margin:4px 0;font-size:13px">Licensed Clearing & Forwarding Agent — Eldoret, Kenya</p>
            <p style="color:#999;font-size:11px;margin:0">Tel: +254 728 548 679 | WhatsApp: +254 728 548 679</p>
        </div>
        <h2 style="color:#1034A6;font-size:16px;margin:0 0 16px">Customs Clearance Invoice</h2>
        <div style="display:flex;gap:30px;margin-bottom:20px">
            <div>
                <p style="font-weight:700;font-size:12px;color:#1034A6;margin:0 0 6px;text-transform:uppercase">Bill To</p>
                <p style="margin:2px 0;font-weight:700">${name}</p>
                <p style="margin:2px 0;font-size:12px;color:#666">${email}</p>
                <p style="margin:2px 0;font-size:12px;color:#666">${phone}</p>
            </div>
            <div>
                <p style="font-weight:700;font-size:12px;color:#1034A6;margin:0 0 6px;text-transform:uppercase">Invoice Details</p>
                <p style="margin:2px 0;font-size:12px"><strong>Date:</strong> ${new Date().toLocaleDateString('en-KE')}</p>
                <p style="margin:2px 0;font-size:12px"><strong>ID:</strong> WM-${Date.now()}</p>
                <p style="margin:2px 0;font-size:12px"><strong>Type:</strong> ${tab.toUpperCase()} Calculator</p>
            </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
                <tr style="background:#1034A6;color:#fff">
                    <th style="padding:10px;text-align:left;border:1px solid #1034A6">Description</th>
                    <th style="padding:10px;text-align:right;border:1px solid #1034A6">Amount (KES)</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map((r,i) => `<tr style="background:${i%2?'#f8f9fa':'#fff'}">
                    <td style="padding:9px 10px;border:1px solid #e0e0e0">${r[0]}</td>
                    <td style="padding:9px 10px;text-align:right;border:1px solid #e0e0e0">${r[1]}</td>
                </tr>`).join('')}
                <tr style="background:#f0f4fa;font-weight:700">
                    <td style="padding:12px 10px;border:1px solid #e0e0e0;font-size:14px">ESTIMATED TOTAL (not charged)</td>
                    <td style="padding:12px 10px;text-align:right;border:1px solid #e0e0e0;font-size:15px;color:#1034A6">${fmt(c.total)}</td>
                </tr>
                <tr style="background:#1034A6;color:#fff;font-weight:700">
                    <td style="padding:12px 10px;border:1px solid #1034A6;font-size:14px">CALCULATOR FEE PAID (M-Pesa)</td>
                    <td style="padding:12px 10px;text-align:right;border:1px solid #1034A6;font-size:16px;color:#B40023">${fmt(CALC_FEE)}</td>
                </tr>
            </tbody>
        </table>
        <div style="background:#f0f4fa;padding:14px;border-radius:6px;margin-top:18px;border-left:3px solid #1034A6;font-size:12px;color:#555">
            <strong>Payment Status:</strong> KES 200 calculator fee completed via M-Pesa<br>
            <strong>Date Paid:</strong> ${new Date().toLocaleString('en-KE')}<br>
            The figures above are an estimate only. Final duty is assessed by KRA at port of entry, and the amounts above are <strong>not</strong> what was charged today &mdash; only the KES 200 calculator fee was collected.<br>
            To have WUSHMAT FAG LTD actually clear this shipment (including these duties, levies and charges), please request a formal quote at wushmatfagltd.co.ke/quote.html or WhatsApp +254 728 548 679.
        </div>
        <div style="text-align:center;margin-top:24px;color:#aaa;font-size:11px;border-top:1px solid #e0e0e0;padding-top:14px">
            WUSHMAT FAG LTD · Clearing & Forwarding Services · Eldoret, Kenya<br>Thank you for your business
        </div>
    </div>`;
 
    html2pdf().set({
        margin:10, filename:`wushmat-invoice-${Date.now()}.pdf`,
        image:{type:'jpeg',quality:.98},
        html2canvas:{scale:2},
        jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}
    }).fromString(html).save();
}
 
// ─────────────────────────────────────────────
//  RESET
// ─────────────────────────────────────────────
function resetPane(tab) {
    document.querySelectorAll(`#pane-${tab} input, #pane-${tab} select, #pane-${tab} textarea`).forEach(el => {
        if (el.tagName === 'SELECT') el.selectedIndex = 0;
        else if (el.id === 'v_entry') {}
        else if (['c_qty','h_qty'].includes(el.id)) el.value = 1;
        else el.value = '';
        el.readOnly && (el.value = '');
    });
    if (tab === 'vehicle') { hide('v_results'); show('v_empty'); document.getElementById('v_pay').disabled=true; }
    if (tab === 'cargo')   { hide('c_results'); show('c_empty'); document.getElementById('c_pay').disabled=true; }
    if (tab === 'hs')      { hide('h_results'); show('h_empty'); document.getElementById('h_pay').disabled=true; selectedHS=null; }
    unlockResults(tab); // clear any leftover lock state so the next estimate starts clean
    currentCalc = null;
}
 
// ─────────────────────────────────────────────
//  MODAL HELPERS
// ─────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
 
// ─────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────
let toastTimer;
function toast(msg, type='info') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `toast ${type} show`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 4500);
}
 
// ─────────────────────────────────────────────
//  UTILS
// ─────────────────────────────────────────────
function fmt(n)  { return 'KES ' + new Intl.NumberFormat('en-KE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n); }
function fmtN(n) { return new Intl.NumberFormat('en-KE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n); }
function pct(n)  { return Math.round(n*100) + '%'; }
function set(id,v){ const el=document.getElementById(id); if(el) el.textContent=v; }
function show(id){ const el=document.getElementById(id); if(el) el.style.display='block'; }
function hide(id){ const el=document.getElementById(id); if(el) el.style.display='none'; }
function fmtPhone(p) {
    p = p.replace(/[\s\-+]/g,'');
    if (p.startsWith('0')) p = '254' + p.substring(1);
    if (!p.startsWith('254')) p = '254' + p;
    return p;
}
function loadModels() { /* placeholder for future model dropdown */ }
