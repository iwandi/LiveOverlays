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
        if(key.toLowerCase().startsWith(name.toLowerCase()))
            return pilotByCallsign.get(key);
    }

    for(const key of pilotByName.keys()){
        if(key.toLowerCase().startsWith(name.toLowerCase()))
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


function updateAllData() {
    updateDataLiveEstimatedPositionResponse();
    updateDataLiveRaceEntryResponse();
}

function updateDataByType(dataType) {
    switch(dataType) {
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

function updateDataLiveEstimatedPositionResponse() {
    updateData('LiveEstimatedPositionResponse', document.getElementById("LiveEstimatedPositionResponseList"));
}

async function updateDataLiveRaceEntryResponse() {
    //updateData('LiveRaceEntryResponse', document.getElementById("LiveRaceEntryResponseList"));
    const data = await getData('LiveRaceEntryResponse');
    await updatePilotDB();

    updateLiveRaceEntryResponse(data);
}

async function getData(dataFile)
{
    // load JSON data from the specified file
    const dataFetch = await fetch(`/data/${dataFile}.json`);
    const data = await dataFetch.json();
    return data;
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
        return;

    dataElement.textContent = elementData;
}

function updateLiveRaceEntryResponse(data) {   
    const root = document.getElementById("LiveRaceEntryResponseList");
    if(root === null || root === undefined)
        return;

    const template = document.getElementById(`LiveRaceEntries`);

    if(template === null | template === undefined)         
        return;

    root.replaceChildren();

    if(data === undefined || data.LiveRaceEntries === undefined)
        return;

    for(const entrie of data.LiveRaceEntries) {                   
        const clones = template.content.cloneNode(true);
        if(clones.children.length === 0)
            continue;
        const element = clones.children[0];

        applyData(entrie.DriverName, "DriverName", element);
        applyData(entrie.LiveEstimatedQualifyingPosition, "LiveEstimatedQualifyingPosition", element);
        applyData(entrie.Top3Consecutive, "Top3Consecutive", element);

        var pilot = getPilot(entrie.DriverLID, entrie.DriverName, entrie.DriverName);
        applyData(pilot?.nationality, "Nationality", element, "---");
        applyData(pilot?.callsign, "CallSign", element);

        var nationalityElement = element.querySelector("#Nationality");
        var hasValidFlag = false;

        if(pilot !== undefined ) {
            applyData(pilot?.name, "DriverName", element);
            if(pilot.flag !== undefined) {
                const style = `background-image: linear-gradient(to right, rgba(255,255,255,0) 5%, var(--backgroundColor) 100%), url('img/flags/${pilot.flag}.svg');`;
                nationalityElement.style.cssText  = "";
                nationalityElement.style.cssText = style;
                hasValidFlag = true;
            }
        }
        if (!hasValidFlag) {
            nationalityElement.style.cssText = "";
        }
        
        root.appendChild(element);
    }
}