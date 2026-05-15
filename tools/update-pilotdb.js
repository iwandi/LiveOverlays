const fs = require('fs/promises');
const path = require('path');
const https = require('https');
const http = require('http');

const IOC_TO_ISO2 = {
    AFG: 'af', ALB: 'al', ALG: 'dz', AND: 'ad', ANG: 'ao', ANT: 'ag', ARG: 'ar', ARM: 'am', ARU: 'aw',
    ASA: 'as', AUS: 'au', AUT: 'at', AZE: 'az', BAH: 'bs', BAN: 'bd', BAR: 'bb', BDI: 'bi', BEL: 'be',
    BEN: 'bj', BER: 'bm', BHU: 'bt', BIH: 'ba', BIZ: 'bz', BLR: 'by', BOL: 'bo', BOT: 'bw', BRA: 'br',
    BRN: 'bh', BRU: 'bn', BUL: 'bg', BUR: 'bf', CAF: 'cf', CAM: 'kh', CAN: 'ca', CAY: 'ky', CGO: 'cd',
    CHA: 'td', CHI: 'cl', CHN: 'cn', CIV: 'ci', CMR: 'cm', COD: 'cd', COK: 'ck', COL: 'co', COM: 'km',
    CPV: 'cv', CRC: 'cr', CRO: 'hr', CUB: 'cu', CYP: 'cy', CZE: 'cz', DEN: 'dk', DJI: 'dj', DMA: 'dm',
    DOM: 'do', ECU: 'ec', EGY: 'eg', ERI: 'er', ESA: 'sv', ESP: 'es', EST: 'ee', ETH: 'et', FIJ: 'fj',
    FIN: 'fi', FRA: 'fr', FSM: 'fm', GAB: 'ga', GAM: 'gm', GBR: 'gb', GBS: 'gw', GEO: 'ge', GEQ: 'gq',
    GER: 'de', GHA: 'gh', GRE: 'gr', GRN: 'gd', GUA: 'gt', GUI: 'gn', GUM: 'gu', GUY: 'gy', HAI: 'ht',
    HKG: 'hk', HON: 'hn', HUN: 'hu', INA: 'id', IND: 'in', IRI: 'ir', IRL: 'ie', IRQ: 'iq', ISL: 'is',
    ISR: 'il', ISV: 'vi', ITA: 'it', IVB: 'vg', JAM: 'jm', JOR: 'jo', JPN: 'jp', KAZ: 'kz', KEN: 'ke',
    KGZ: 'kg', KIR: 'ki', KOR: 'kr', KOS: 'xk', KSA: 'sa', KUW: 'kw', LAO: 'la', LAT: 'lv', LBA: 'ly',
    LBR: 'lr', LCA: 'lc', LES: 'ls', LIB: 'lb', LIE: 'li', LTU: 'lt', LUX: 'lu', MAD: 'mg', MAR: 'ma',
    MAS: 'my', MAW: 'mw', MDA: 'md', MDV: 'mv', MEX: 'mx', MGL: 'mn', MHL: 'mh', MKD: 'mk', MLI: 'ml',
    MLT: 'mt', MNE: 'me', MON: 'mc', MOZ: 'mz', MRI: 'mu', MTN: 'mr', MYA: 'mm', NAM: 'na', NCA: 'ni',
    NED: 'nl', NEP: 'np', NGR: 'ng', NIG: 'ne', NOR: 'no', NRU: 'nr', NZL: 'nz', OMA: 'om', PAK: 'pk',
    PAN: 'pa', PAR: 'py', PER: 'pe', PHI: 'ph', PLE: 'ps', PLW: 'pw', PNG: 'pg', POL: 'pl', POR: 'pt',
    PRK: 'kp', PUR: 'pr', QAT: 'qa', ROU: 'ro', RSA: 'za', RUS: 'ru', RWA: 'rw', SAM: 'ws', SEN: 'sn',
    SEY: 'sc', SGP: 'sg', SKN: 'kn', SLE: 'sl', SLO: 'si', SMR: 'sm', SOL: 'sb', SOM: 'so', SRB: 'rs',
    SRI: 'lk', SSD: 'ss', STP: 'st', SUD: 'sd', SUI: 'ch', SUR: 'sr', SVK: 'sk', SWE: 'se', SWZ: 'sz',
    SYR: 'sy', TAN: 'tz', TGA: 'to', THA: 'th', TJK: 'tj', TKM: 'tm', TLS: 'tl', TOG: 'tg', TPE: 'tw',
    TTO: 'tt', TUN: 'tn', TUR: 'tr', TUV: 'tv', UAE: 'ae', UGA: 'ug', UKR: 'ua', URU: 'uy', USA: 'us',
    UZB: 'uz', VAN: 'vu', VEN: 've', VIE: 'vn', VIN: 'vc', YEM: 'ye', ZAM: 'zm', ZIM: 'zw'
};

const ISO2_TO_IOC = Object.fromEntries(
    Object.entries(IOC_TO_ISO2).map(([ioc, iso2]) => [iso2.toUpperCase(), ioc])
);

const COUNTRY_NAME_TO_IOC = {
    germany: 'GER',
    france: 'FRA',
    italy: 'ITA',
    austria: 'AUT',
    switzerland: 'SUI',
    netherlands: 'NED',
    belgium: 'BEL',
    czechia: 'CZE',
    'czech republic': 'CZE',
    slovakia: 'SVK',
    sweden: 'SWE',
    estonia: 'EST',
    usa: 'USA',
    'united states': 'USA',
    uk: 'GBR',
    'great britain': 'GBR',
    england: 'GBR',
    poland: 'POL',
    japan: 'JPN',
    'south korea': 'KOR',
    israel: 'ISR',
    greece: 'GRE',
    latvia: 'LAT',
    turkey: 'TUR',
    azerbaijan: 'AZE'
};

const DEFAULT_PILOT = {
    DriverLID: -1,
    name: '',
    callsign: '',
    nationality: '',
    flag: '',
    image: ''
};

async function readJson(filePath) {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
}

async function readJsonIfExists(filePath) {
    try {
        return await readJson(filePath);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return null;
        }
        throw error;
    }
}

function normalizeName(value) {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

function normalizeCallsign(value) {
    return String(value || '').trim();
}

function normalizeNationality(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';

    const upper = trimmed.toUpperCase();
    if (/^[A-Z]{3}$/.test(upper)) return upper;
    if (/^[A-Z]{2}$/.test(upper)) return ISO2_TO_IOC[upper] || '';

    const byName = COUNTRY_NAME_TO_IOC[trimmed.toLowerCase()];
    return byName || '';
}

function flagFromNationality(nationality) {
    const ioc = normalizeNationality(nationality);
    return ioc ? (IOC_TO_ISO2[ioc] || '') : '';
}

function upsertPilot(targetPilots, incoming) {
    const incomingLid = Number.isInteger(incoming.DriverLID) ? incoming.DriverLID : -1;
    const incomingName = normalizeName(incoming.name);
    const incomingCallsign = normalizeCallsign(incoming.callsign);

    const existing = targetPilots.find((pilot) => {
        if (incomingLid > -1 && Number(pilot.DriverLID) === incomingLid) return true;
        if (incomingName && normalizeName(pilot.name) === incomingName) return true;
        if (incomingCallsign && normalizeCallsign(pilot.callsign) === incomingCallsign) return true;
        return false;
    });

    const normalizedIncoming = { ...incoming };
    if (normalizedIncoming.nationality) {
        normalizedIncoming.nationality = normalizeNationality(normalizedIncoming.nationality);
    }
    if (!normalizedIncoming.flag && normalizedIncoming.nationality) {
        normalizedIncoming.flag = flagFromNationality(normalizedIncoming.nationality);
    }

    if (!existing) {
        targetPilots.push({ ...DEFAULT_PILOT, ...normalizedIncoming });
        return;
    }

    Object.entries(normalizedIncoming).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (typeof value === 'string' && value.trim() === '') return;
        existing[key] = value;
    });

    if (existing.nationality && !existing.flag) {
        existing.flag = flagFromNationality(existing.nationality);
    }
}

function pilotsFromLiveEstimatedPosition(response) {
    if (!response || !Array.isArray(response.LiveEstimatedPositions)) return [];

    return response.LiveEstimatedPositions
        .filter((entry) => entry && entry.DriverName)
        .map((entry) => ({
            DriverLID: Number.isInteger(entry.DriverLID) ? entry.DriverLID : -1,
            name: String(entry.DriverName).trim(),
            callsign: '',
            nationality: '',
            flag: '',
            image: ''
        }));
}

function decodeHtmlEntities(text) {
    return text
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, '\'')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

function stripTags(html) {
    return decodeHtmlEntities(String(html || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function extractFromObject(value, candidates = []) {
    if (!value || typeof value !== 'object') return candidates;

    if (Array.isArray(value)) {
        for (const item of value) extractFromObject(item, candidates);
        return candidates;
    }

    const name = value.name || value.fullName || value.pilotName || value.driverName;
    const callsign = value.callsign || value.nickName || value.nickname || value.handle;
    const nationality = value.nationality || value.countryCode || value.country || value.nation;

    if (name && (callsign || nationality)) {
        candidates.push({
            name: String(name).trim(),
            callsign: callsign ? String(callsign).trim() : '',
            nationality: normalizeNationality(nationality),
            flag: flagFromNationality(nationality)
        });
    }

    for (const nested of Object.values(value)) {
        extractFromObject(nested, candidates);
    }

    return candidates;
}

function extractCandidatesFromRegistrationTable(html) {
    const matches = [];
    const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];

    for (const row of rows) {
        const cells = row.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || [];
        if (cells.length < 2) continue;
        const values = cells.map(stripTags).filter(Boolean);
        if (values.length < 2) continue;

        const [name, callsign, nationality] = values;
        if (!name || /name/i.test(name)) continue;

        const nat = normalizeNationality(nationality);
        matches.push({
            name,
            callsign: callsign || '',
            nationality: nat,
            flag: flagFromNationality(nat)
        });
    }
    return matches;
}

function extractCandidatesFromHtml(html) {
    const candidates = [];

    const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script[^>]*>/gi;
    let scriptMatch = null;
    while ((scriptMatch = scriptRegex.exec(html)) !== null) {
        const content = (scriptMatch[1] || '').trim();
        if (!content) continue;
        const jsonCandidates = [];

        if (content.startsWith('{') || content.startsWith('[')) {
            jsonCandidates.push(content);
        } else {
            const assignment = content.match(/=\s*(\{[\s\S]*\}|\[[\s\S]*\])\s*;?\s*$/);
            if (assignment) jsonCandidates.push(assignment[1]);
        }

        for (const jsonText of jsonCandidates) {
            try {
                const parsed = JSON.parse(jsonText);
                extractFromObject(parsed, candidates);
            } catch {
                // best effort, skip non-JSON script content
            }
        }
    }

    candidates.push(...extractCandidatesFromRegistrationTable(html));
    return candidates;
}

function findCandidateForPilot(pilot, candidates) {
    const pilotName = normalizeName(pilot.name);
    if (!pilotName) return null;

    return candidates.find((candidate) => normalizeName(candidate.name) === pilotName) || null;
}

function fetchText(url, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https://') ? https : http;
        client
            .get(url, (res) => {
                if (
                    res.statusCode >= 300 &&
                    res.statusCode < 400 &&
                    res.headers.location &&
                    redirectCount < 5
                ) {
                    const redirectUrl = new URL(res.headers.location, url).toString();
                    res.resume();
                    resolve(fetchText(redirectUrl, redirectCount + 1));
                    return;
                }

                if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                    res.resume();
                    reject(new Error(`Request failed for ${url} with status ${res.statusCode}`));
                    return;
                }

                let data = '';
                res.setEncoding('utf8');
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => resolve(data));
            })
            .on('error', reject);
    });
}

function parseRegistrationUrlArg(argv) {
    const explicit = argv.find((arg) => arg.startsWith('--registration-url='));
    if (explicit) {
        return explicit.slice('--registration-url='.length);
    }
    return argv.find((arg) => /^https?:\/\//i.test(arg)) || null;
}

async function main() {
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h')) {
        console.log('Usage: npm run update-pilotdb -- [--registration-url=<url>]');
        console.log('Merges optional data/manual/merge_pilotdb.sjon or .json,');
        console.log('adds missing pilots from data/LiveEstimatedPositionResponse.json,');
        console.log('and enriches pilots from MultiGP and optional registration page.');
        return;
    }

    const rootDir = path.resolve(__dirname, '..');
    const dataDir = path.join(rootDir, 'data');
    const manualDir = path.join(dataDir, 'manual');
    const pilotDbPath = path.join(manualDir, 'pilotdb.json');
    const mergeSjonPath = path.join(manualDir, 'merge_pilotdb.sjon');
    const mergeJsonPath = path.join(manualDir, 'merge_pilotdb.json');
    const liveEstimatedPath = path.join(dataDir, 'LiveEstimatedPositionResponse.json');
    const registrationUrl = parseRegistrationUrlArg(args);
    const lookupUrls = [
        'https://www.multigp.com/pilots/all-pilots/',
        registrationUrl
    ].filter(Boolean);

    const pilotDb = await readJson(pilotDbPath);
    if (!pilotDb || !Array.isArray(pilotDb.pilots)) {
        throw new Error(`Invalid pilot database format: ${pilotDbPath}`);
    }

    const mergeData =
        (await readJsonIfExists(mergeSjonPath)) ||
        (await readJsonIfExists(mergeJsonPath));
    if (mergeData && Array.isArray(mergeData.pilots)) {
        for (const pilot of mergeData.pilots) {
            upsertPilot(pilotDb.pilots, pilot);
        }
    }

    const liveEstimatedData = await readJsonIfExists(liveEstimatedPath);
    const extractedPilots = pilotsFromLiveEstimatedPosition(liveEstimatedData);
    for (const pilot of extractedPilots) {
        upsertPilot(pilotDb.pilots, pilot);
    }

    const allCandidates = [];
    for (const url of lookupUrls) {
        try {
            const html = await fetchText(url);
            allCandidates.push(...extractCandidatesFromHtml(html));
            console.log(`Loaded pilot lookup candidates from ${url}`);
        } catch (error) {
            console.warn(`Lookup failed for ${url}: ${error.message}`);
        }
    }

    if (allCandidates.length > 0) {
        for (const pilot of pilotDb.pilots) {
            if (pilot.callsign && pilot.nationality && pilot.flag) continue;
            const candidate = findCandidateForPilot(pilot, allCandidates);
            if (!candidate) continue;

            if (!pilot.callsign && candidate.callsign) pilot.callsign = candidate.callsign;

            const normalizedNationality = normalizeNationality(candidate.nationality);
            if (!pilot.nationality && normalizedNationality) {
                pilot.nationality = normalizedNationality;
            }

            if (!pilot.flag) {
                pilot.flag = flagFromNationality(pilot.nationality || normalizedNationality || candidate.nationality);
            }
        }
    }

    for (const pilot of pilotDb.pilots) {
        if (pilot.nationality) {
            pilot.nationality = normalizeNationality(pilot.nationality) || pilot.nationality;
        }
        if (!pilot.flag && pilot.nationality) {
            pilot.flag = flagFromNationality(pilot.nationality);
        }
    }

    await fs.writeFile(pilotDbPath, JSON.stringify(pilotDb, null, 4) + '\n', 'utf8');
    console.log(`Updated pilot database: ${pilotDbPath}`);
}

main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
});
