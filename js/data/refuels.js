// The dummy refuels of the demo day: one end-of-day top-up per vehicle, as written on the receipt.
// Only what the driver reports is typed here (liters, price, odometer). The fuel page CALCULATES
// the expected liters from the GPS distance and the mismatch %, so nothing here is a percentage.
//
// Planted for the demo: 2 vehicles bought clearly more fuel than their distance needs
// (AB 1159 XY and AB 1675 FD), so the report shows them in red (over 5%).
// Refuels that users add with the form are saved by js/storage.js, not here.

// Price of Pertalite fuel used for the demo, in rupiah per liter.
const FUEL_PRICE_PER_LITER = 10000;

// time = clock time of the refuel on the demo day, totalPrice = rupiah paid,
// odometerKm = what the car's odometer showed at the pump.
const REFUELS = [
  { plate: "AB 1012 XY", time: "08:20", liters: 2.15, totalPrice: 21500, odometerKm: 30022, station: "SPBU Jl. Magelang" },
  { plate: "AB 1047 GK", time: "09:13", liters: 0.82, totalPrice: 8200, odometerKm: 37929, station: "SPBU Gejayan" },
  { plate: "AB 1083 FD", time: "09:22", liters: 1.09, totalPrice: 10900, odometerKm: 45849, station: "SPBU Jl. Sudirman" },
  { plate: "AB 1126 UV", time: "09:30", liters: 3.46, totalPrice: 34600, odometerKm: 53784, station: "SPBU Jl. Parangtritis" },
  { plate: "AB 1159 XY", time: "10:07", liters: 3.44, totalPrice: 34400, odometerKm: 61705, station: "SPBU Jl. Magelang" },
  { plate: "AB 1194 GK", time: "08:28", liters: 0.29, totalPrice: 2900, odometerKm: 69608, station: "SPBU Gejayan" },
  { plate: "AB 1238 FD", time: "08:44", liters: 1.76, totalPrice: 17600, odometerKm: 77532, station: "SPBU Jl. Sudirman" },
  { plate: "AB 1271 UV", time: "08:53", liters: 0.34, totalPrice: 3400, odometerKm: 35448, station: "SPBU Jl. Parangtritis" },
  { plate: "AB 1305 XY", time: "11:36", liters: 5.32, totalPrice: 53200, odometerKm: 43417, station: "SPBU Jl. Magelang" },
  { plate: "AB 1342 GK", time: "10:52", liters: 2.38, totalPrice: 23800, odometerKm: 51299, station: "SPBU Gejayan" },
  { plate: "AB 1376 FD", time: "08:23", liters: 0.21, totalPrice: 2100, odometerKm: 59199, station: "SPBU Jl. Sudirman" },
  { plate: "AB 1419 UV", time: "09:23", liters: 0.99, totalPrice: 9900, odometerKm: 67119, station: "SPBU Jl. Parangtritis" },
  { plate: "AB 1453 XY", time: "09:30", liters: 1.77, totalPrice: 17700, odometerKm: 75050, station: "SPBU Jl. Magelang" },
  { plate: "AB 1487 GK", time: "09:23", liters: 1.11, totalPrice: 11100, odometerKm: 32956, station: "SPBU Gejayan" },
  { plate: "AB 1520 FD", time: "10:07", liters: 3.18, totalPrice: 31800, odometerKm: 40898, station: "SPBU Jl. Sudirman" },
  { plate: "AB 1564 UV", time: "08:53", liters: 1.15, totalPrice: 11500, odometerKm: 48799, station: "SPBU Jl. Parangtritis" },
  { plate: "AB 1598 XY", time: "08:37", liters: 0.32, totalPrice: 3200, odometerKm: 56718, station: "SPBU Jl. Magelang" },
  { plate: "AB 1631 GK", time: "09:01", liters: 1.11, totalPrice: 11100, odometerKm: 64634, station: "SPBU Gejayan" },
  { plate: "AB 1675 FD", time: "09:45", liters: 4.76, totalPrice: 47600, odometerKm: 72576, station: "SPBU Jl. Sudirman" },
  { plate: "AB 1709 UV", time: "10:31", liters: 1.54, totalPrice: 15400, odometerKm: 30480, station: "SPBU Jl. Parangtritis" },
];
