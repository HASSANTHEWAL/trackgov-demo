// Places used in the TrackGov demo (Yogyakarta).
// official: true  = on the list of official destinations for government cars
// official: false = NOT official. parkMinutes = how long the demo car parks there (used to trigger an alert)

const PLACES = {
  kepatihan: { name: "Kompleks Kepatihan", lat: -7.7905, lng: 110.3665, official: true },
  dinkes: { name: "Kantor Dinas Kesehatan", lat: -7.7838, lng: 110.3889, official: true },
  dpu: { name: "Kantor Dinas PU", lat: -7.7868, lng: 110.3607, official: true },
  bpbd: { name: "Kantor BPBD", lat: -7.799, lng: 110.39, official: true },
  balaikota: { name: "Balai Kota Yogyakarta", lat: -7.8007, lng: 110.392, official: true },
  sardjito: { name: "RSUP Dr. Sardjito", lat: -7.7684, lng: 110.3735, official: true },
  ugm: { name: "Kampus UGM", lat: -7.7705, lng: 110.3778, official: true },
  rsud: { name: "RSUD Kota Yogyakarta", lat: -7.8257, lng: 110.3832, official: true },
  kotagede: { name: "Kemantren Kotagede", lat: -7.827, lng: 110.399, official: true },
  bantul: { name: "Kantor Pemkab Bantul", lat: -7.8879, lng: 110.3291, official: true },
  sleman: { name: "Kantor Pemkab Sleman", lat: -7.7155, lng: 110.3555, official: true },
  bandara: { name: "Bandara Adisutjipto", lat: -7.7881, lng: 110.4317, official: true },
  giwangan: { name: "Terminal Giwangan", lat: -7.8335, lng: 110.3925, official: true },
  prambanan: { name: "Kawasan Prambanan", lat: -7.752, lng: 110.4915, official: true },
  stasiun: { name: "Stasiun Tugu", lat: -7.7894, lng: 110.3632, official: true },
  bethesda: { name: "RS Bethesda", lat: -7.7836, lng: 110.378, official: true },
  parangtritis: {
    name: "Pantai Parangtritis",
    lat: -8.0247,
    lng: 110.3292,
    official: false,
    parkMinutes: 96,
  },
  amplaz: {
    name: "Ambarrukmo Plaza",
    lat: -7.7827,
    lng: 110.4015,
    official: false,
    parkMinutes: 47,
  },
  alkid: { name: "Alun-alun Kidul", lat: -7.8118, lng: 110.3632, official: false, parkMinutes: 38 },
  jcm: { name: "Jogja City Mall", lat: -7.7531, lng: 110.3615, official: false, parkMinutes: 52 },
};

// Extra names shown on the map so people can see where they are
const LANDMARKS = [
  { name: "Tugu", lat: -7.7829, lng: 110.3671 },
  { name: "Malioboro", lat: -7.7925, lng: 110.3658 },
  { name: "Kraton", lat: -7.8053, lng: 110.3642 },
  { name: "Ring Road Utara", lat: -7.7598, lng: 110.401 },
  { name: "Ring Road Selatan", lat: -7.8382, lng: 110.361 },
];
