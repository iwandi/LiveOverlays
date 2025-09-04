const pilotByLID = new Map();
const pilotByName = new Map();
const pilotByCallsign = new Map();

async function updatePilotDB(){
    const dataFetch = await fetch('/data/manual/pilotdb.json');
    const data = await dataFetch.json();

    if(data === undefined)
        return;
    for(const pilot of data.pilots){
        if(pilot.DriverLID != undefined && pilot.DriverLID > -1)
            pilotByLID.set(pilot.DriverLID, pilot);
    
        if(pilot.name != undefined)
            pilotByName.set(pilot.name, pilot);

        if(pilot.callsign != undefined)
            pilotByCallsign.set(pilot.callsign, pilot);
    }
}

function getElementByLID(id){
    if(pilotByLID.has(id))
        return pilotByLID.get(id);
    return undefined;
}

function getPilorByName(name) {
    if(pilotByName.has(name))
        return pilotByName.get(name);   
    return undefined;
}

function getPilotByLooseName(name) {
    if(name === undefined)
        return undefined;

    for(const key of pilotByCallsign.keys()){
        var keyLower = key.toLowerCase();
        var nameLower = name.toLowerCase();
        if(keyLower.startsWith(nameLower) ||
            nameLower.startsWith(keyLower))
            return pilotByCallsign.get(key);
    }

    for(const key of pilotByName.keys()){
        var keyLower = key.toLowerCase();
        var nameLower = name.toLowerCase();
        if(keyLower.startsWith(nameLower) ||
            nameLower.startsWith(keyLower))
            return pilotByName.get(key);
    }
}

function getPilot(id, name, looseName){
    var pilot = getElementByLID(id);
    if(pilot != undefined)
        return pilot;

    pilot = getPilorByName(name);
    if(pilot != undefined)
       return pilot;

    pilot = getPilotByLooseName(looseName);
    if(pilot != undefined)
       return pilot;
    return undefined;
}

var eventData = null;

async function updateEventData() {
    const dataFetch = await fetch('/data/manual/event.json');
    const data = await dataFetch.json();

    eventData = data;
}

function getGridPosition(entrie) {
    if(entrie === null || entrie === undefined ||
        entrie.FrequencyName === null || entrie.FrequencyName === undefined)
        return -1;

    const frequencyName = entrie.FrequencyName;
    for(const pos of eventData.grid)
    {
        if(frequencyName.startsWith(pos.FrequencyName))
            return pos.gridPosition;
    }

    return -1;
}

function sortByGrid(lhs, rhs) {
    const lhsGrid = getGridPosition(lhs);
    const rhsGrid = getGridPosition(rhs);
    return lhsGrid - rhsGrid;
}

function updateAllData() {
    updateEventData();
    updateDataLiveRaceStateResponse();
    updateDataLiveEstimatedPositionResponse();
    updateDataLiveRaceEntryResponse();
}

function updateDataByType(dataType) {
    switch(dataType) {
        case 'LiveRaceStateResponse':
            updateDataLiveRaceStateResponse();
            break;
        case 'LiveEstimatedPositionResponse':
            updateDataLiveEstimatedPositionResponse();
            break;
        case 'LiveRaceEntryResponse':
            updateDataLiveRaceEntryResponse();
            break;
        default:
            console.warn(`Unknown data type: ${dataType}`);
    }
}

async function updateDataLiveRaceStateResponse() {
    const data = await getData('LiveRaceStateResponse');
    updateLiveRaceStateResponse(data);
}

async function updateDataLiveEstimatedPositionResponse() {
    const data = await getData('LiveEstimatedPositionResponse');
    await updatePilotDB();
    updateLiveEstimatedPositionResponse(data);
}

async function updateDataLiveRaceEntryResponse() {
    const data = await getData('LiveRaceEntryResponse');
    await updatePilotDB();
    updateLiveRaceEntryResponse(data);
}

async function getData(dataFile)
{
    // load JSON data from the specified file
    var done = false;
    while(!done) {
        try {
            const dataFetch = await fetch(`/data/${dataFile}.json`);
            const data = await dataFetch.json();
            done = true;
            return data;
        } catch (error) {
            console.error(`Error fetching ${dataFile}.json:`, error);
        }
    }
    return undefined;
}

async function updateData(dataFile, root)
{
    var data = await getData(dataFile);

    updateElement(data, root);
}

function updateElement(obj, root) {
    if(root === null || root === undefined) {
        console.warn("Root element is null or undefined");
        return;
    }

    // enum all properties of the object
    Object.entries(obj).forEach(([key, value]) => {
        // check if value is a array
        if (Array.isArray(value)) {            
            const template = document.querySelector(`#${key}`);
            if(template && template.content) {
                root.replaceChildren();

                for (const item of value) {                    
                    const clones = template.content.cloneNode(true);
                    if(clones.children.length === 0)
                        continue;
                    const element = clones.children[0];
                    updateElement(item, element);
                    root.appendChild(element);
                }
            }
        }
        else{
            // try to fill the element
            const element =  root.querySelector(`#${key}`);
            if(element) {
                if(!formatSpecail(key, value, element)) {
                    element.textContent = value;
                }
            }

            // try to set class of root
            if (root.classList && typeof value === "boolean") {
                if(value) {
                    root.classList.add(key);
                }
                else if (root.classList.contains(key)) {
                    root.classList.remove(key);
                }
            }
        }
    });
}

function formatSpecail(key, value, element) {
    switch(key) {
        case 'PositionChange':
            formatSpecialRelativeChange(key, value, element);
            return true;
    }
    return false;
}

function formatSpecialRelativeChange(key, value, element) {
    // remove ValueChangePositive and ValueChangeNegative classes
    element.classList.remove('ValueChangePositive', 'ValueChangeNegative');

    if (value === 0) {
        element.textContent = '';
    } else if (value > 0) {
        element.textContent = `+${value}`;
        element.classList.add('ValueChangePositive');
    } else {
        element.textContent = `${value}`;
        element.classList.add('ValueChangeNegative');
    }
    return true;
}

let ws;
const reconnectDelay = 1000; 
function connectWebSocket() {
    ws = new WebSocket("ws://localhost:8080/ws/");

    ws.onopen = () => console.log("Connected");
    ws.onmessage = e => {
        console.log("Received:", e.data);
        updateDataByType(e.data);
    };
    ws.onclose = onWebSocketClose;
    ws.onerror = err => {
        console.error("WebSocket error:", err);
        ws.close(); // ensure close triggers reconnect
    };
}

function onWebSocketClose(){
    console.warn("Disconnected, retrying in " + reconnectDelay / 1000 + "s...");
    setTimeout(connectWebSocket, reconnectDelay);
}

function applyData(elementData, elementId, element, nullValue = "") {
    if(elementData === undefined)
        elementData = nullValue;
    
    var dataElement = element.querySelector("#" + elementId);
    if(dataElement === null || dataElement === undefined)
    {
        if(element.id === elementId)
            dataElement = element;
        else
            return;
    }
    dataElement.textContent = elementData;
}

function formatTime(time, digits = 3) {
    if(time === undefined || time === null)
        return "---";
    const formatted = parseFloat(time).toFixed(digits);
    return formatted.padStart(digits, '0');
}

function applyVisible(visible, elementId, element) {
    if(visible === undefined)
        visible = false;

    var dataElement = element.querySelector("#" + elementId);
    if(dataElement === null || dataElement === undefined)
        return;

    dataElement.style.display = visible ? "" : "none";
}

function applyVisibleClass(visible, className) {
    if(visible === undefined)
        visible = false;

    var dataElement = document.querySelector("." + className);
    if(dataElement === null || dataElement === undefined)
        return;

    dataElement.style.display = visible ? "" : "none";
}

var isRace = false;
var isQualifying = false;

function updateLiveRaceStateResponse(data) {    
    isRace = data.RoundType == 3;
    isQualifying = data.RoundType == 2;

    const root = document.getElementById("LiveRaceStateResponse");
    if(root === null || root === undefined)
        return;

    applyData(data.RaceName, "RaceName", root);
    applyData(data.RaceClassInformation, "RaceClassInformation", root);
    applyData(data.RoundLetterTypeOrderNumberDisplay, "RoundLetterTypeOrderNumberDisplay", root);

    applyVisibleClass(isRace, "IsRenableInRaceace");
    applyVisibleClass(isQualifying, "enableInQualifying");
}

function sortByPos(lhs, rhs) {
    const lhsGrid = lhs.Position;
    const rhsGrid = rhs.Position;
    return lhsGrid - rhsGrid;
}

var alwaysSortByGrid = false;
function updateLiveRaceEntryResponse(data) {   
    const root = document.getElementById("LiveRaceEntryResponseList");
    if(root === null || root === undefined)
        return;

    const template = document.getElementById(`LiveRaceEntries`);
    const templateLaps = document.getElementById(`LiveRaceEntryLaps`);
    const tampleteLapsIsValid = templateLaps !== null && templateLaps !== undefined;

    if(template === null | template === undefined)         
        return;

    root.replaceChildren();

    if(data === undefined || data.LiveRaceEntries === undefined)
        return;

    var entires = data.LiveRaceEntries;
    var applySortByGrid = !isRace;
    if(alwaysSortByGrid)
        applySortByGrid = true;

    if(applySortByGrid)
        entires = entires.sort(sortByGrid);
    else
        entires = entires.sort(sortByPos);

    for(const entrie of entires) {                   
        const clones = template.content.cloneNode(true);
        if(clones.children.length === 0)
            continue;
        const element = clones.children[0];

        applyVisible(isRace, "IsRace", element);
        applyVisible(isQualifying, "IsQualifying", element);
        applyVisible(isQualifying, "LiveEstimatedQualifyingPosition", element);
        applyVisible(isQualifying, "Top3Consecutive", element);
        applyVisible(isRace, "Position", element);
        applyVisible(isRace, "Number", element);
        applyVisible(isRace, "SortTimeBehindPositionAbove", element);

        applyData(entrie.DriverName, "DriverName", element);
        applyData(entrie.Position, "Position", element);
        applyData(entrie.Number, "Number", element);
        applyData(entrie.FrequencyName, "FrequencyName", element);
        applyData(formatTime(entrie.SortTimeBehindPositionAbove), "SortTimeBehindPositionAbove", element);
        applyData(entrie.LiveEstimatedQualifyingPosition, "LiveEstimatedQualifyingPosition", element);
        applyData(formatTime(entrie.Top3Consecutive), "Top3Consecutive", element);

        var pilot = getPilot(entrie.DriverLID, entrie.DriverName, entrie.DriverName);
        applyData(pilot?.nationality, "Nationality", element, "---");
        applyData(pilot?.callsign, "CallSign", element);
        
        var fullName = entrie.DriverName;
        if(pilot !== undefined)
        {
            fullName = pilot.name + " | " + pilot.callsign;
        }
        applyData(fullName, "FullName", element);

        const lapsRoot = element.querySelector("#LiveRaceEntryLapsList");
        const lapsRootIsValid = lapsRoot !== null && lapsRoot !== undefined;

        if(tampleteLapsIsValid && lapsRootIsValid) {
            for(const lap of entrie.LiveRaceEntryLaps) {
                const clones = templateLaps.content.cloneNode(true);
                if(clones.children.length === 0)
                    continue;
                const elementLap = clones.children[0];

                applyData(formatTime(lap.LapTimeSeconds, 2), "LapTimeSeconds", elementLap);
                lapsRoot.appendChild(elementLap);
            }
        }

        var nationalityElement = element.querySelector("#Nationality");
        var nationalityElementIsValid = nationalityElement !== null && nationalityElement !== undefined;
        var hasValidFlag = false;

        if(pilot !== undefined && nationalityElementIsValid) {
            applyData(pilot?.name, "DriverName", element);
            if(pilot.flag !== undefined) {
                const style = `background-image: linear-gradient(to right, rgba(255,255,255,0) 5%, var(--backgroundColor) 100%), url('img/flags/${pilot.flag}.svg');`;
                nationalityElement.style.cssText  = "";
                nationalityElement.style.cssText = style;
                hasValidFlag = true;
            }
        }
        if (!hasValidFlag && nationalityElementIsValid) {
            nationalityElement.style.cssText = "";
        }
        
        root.appendChild(element);
    }
}

function updateLiveEstimatedPositionResponse(data) {   
    const root = document.getElementById("LiveEstimatedPositionResponseList");
    if(root === null || root === undefined)
        return;

    const template = document.getElementById(`LiveEstimatedPositionResponse`);

    if(template === null | template === undefined)         
        return;

    root.replaceChildren();

    if(data === undefined || data.LiveEstimatedPositions === undefined)
        return;

    var position = 0;
    const pageCount = Math.ceil(data.LiveEstimatedPositions.length / entriesPerPage);
    const startPosition = entriesPerPage * (page % pageCount);
    const endPosition = startPosition + entriesPerPage;
    for(const entrie of data.LiveEstimatedPositions) {                
        if(position >= endPosition)
            break;

        if(position < startPosition) {
            position++;
            continue;
        }

        position++;

        const clones = template.content.cloneNode(true);
        if(clones.children.length === 0)
            continue;
        const element = clones.children[0];

        applyData(entrie.DriverName, "DriverName", element);
        applyData(entrie.Position, "Position", element);
        applyData(formatTime(entrie.BestSeedingResult), "BestSeedingResult", element);    

        var pilot = getPilot(entrie.DriverLID, entrie.DriverName, entrie.DriverName);
        applyData(pilot?.nationality, "Nationality", element, "---");
        applyData(pilot?.callsign, "CallSign", element);

        var fullName = entrie.DriverName;
        if(pilot !== undefined)
        {
            fullName = pilot.name + " | " + pilot.callsign;
        }
        applyData(fullName, "FullName", element);

        var nationalityElement = element.querySelector("#Nationality");
        var nationalityElementIsValid = nationalityElement !== null && nationalityElement !== undefined;
        var hasValidFlag = false;

        if(pilot !== undefined ) {
            applyData(pilot?.name, "DriverName", element);
            if(pilot.flag !== undefined && nationalityElementIsValid) {
                const style = `background-image: linear-gradient(to right, rgba(255,255,255,0) 5%, var(--backgroundColor) 100%), url('img/flags/${pilot.flag}.svg');`;
                nationalityElement.style.cssText  = "";
                nationalityElement.style.cssText = style;
                hasValidFlag = true;
            }
        }
        if (!hasValidFlag & nationalityElementIsValid) {
            nationalityElement.style.cssText = "";
        }
        
        root.appendChild(element);
    }
}

var page = 0;
var entriesPerPage = 12;
var pageInterval = 7000; // 15 seconds
function startPageTimer() {
    setInterval(() => {
        nextPage();
    }, pageInterval);
}

function nextPage() {
    page++;
    updateAllData();
}