// ISO 3166-1 alpha-2 codes from the IANA time zone database's iso3166.tab.
const countryCodes = `
AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL
BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV
CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD
GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM
IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK
LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW
MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PB PE PF PG PH PK PL PM PN
PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SS
ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY
UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW
`.trim().split(/\s+/);

// Some Intl runtimes enumerate older spellings even though they accept the
// current IANA identifiers. Keep the location names users look for today.
const preferredZones = new Map(Object.entries({
  "Africa/Asmera": "Africa/Asmara",
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "America/Catamarca": "America/Argentina/Catamarca",
  "America/Coral_Harbour": "America/Atikokan",
  "America/Cordoba": "America/Argentina/Cordoba",
  "America/Godthab": "America/Nuuk",
  "America/Indianapolis": "America/Indiana/Indianapolis",
  "America/Jujuy": "America/Argentina/Jujuy",
  "America/Louisville": "America/Kentucky/Louisville",
  "America/Mendoza": "America/Argentina/Mendoza",
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Rangoon": "Asia/Yangon",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Atlantic/Faeroe": "Atlantic/Faroe",
  "Europe/Kiev": "Europe/Kyiv",
  "Pacific/Enderbury": "Pacific/Kanton",
  "Pacific/Ponape": "Pacific/Pohnpei",
  "Pacific/Truk": "Pacific/Chuuk",
}));

function preferredZone(value: string) {
  const preferred = preferredZones.get(value);
  if (!preferred) return value;
  try {
    new Intl.DateTimeFormat("en", { timeZone: preferred });
    return preferred;
  } catch {
    return value;
  }
}

export type RegionalOption = { value: string; label: string };
export type RegionalOptions = Record<"country" | "currency" | "timezone", RegionalOption[]>;

let options: RegionalOptions | undefined;

// Build on the server so the browser sees the same catalog as profile validation.
export function getRegionalOptions(): RegionalOptions {
  if (!options) {
    const regions = new Intl.DisplayNames("en", { type: "region" });
    const currencies = new Intl.DisplayNames("en", { type: "currency" });
    const order = new Intl.Collator("en");
    const sort = (items: RegionalOption[]) =>
      items.sort((a, b) => order.compare(a.label, b.label));
    options = {
      country: sort(countryCodes.map(value => ({ value, label: regions.of(value) ?? value }))),
      currency: sort(Intl.supportedValuesOf("currency").map(value => ({
        value,
        label: `${currencies.of(value) ?? value} (${value})`,
      }))),
      timezone: [
        { value: "UTC", label: "UTC (Coordinated Universal Time)" },
        ...sort([...new Set(Intl.supportedValuesOf("timeZone").map(preferredZone))].filter(value => value !== "UTC").map(value => {
          const parts = value.replaceAll("_", " ").split("/");
          const city = parts.pop();
          return { value, label: parts.length ? `${city} (${parts.join(" / ")})` : value };
        })),
      ],
    };
  }
  return options;
}
