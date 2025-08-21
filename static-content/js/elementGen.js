console.log('test');

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

function updateDataLiveRaceEntryResponse() {
    updateData('LiveRaceEntryResponse', document.getElementById("LiveRaceEntryResponseList"));
}

async function updateData(dataFile, root)
{
    // load JSON data from the specified file
    const dataFetch = await fetch(`/data/${dataFile}.json`);
    const data = await dataFetch.json();

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

function formatSpecialRelativeChange(key, value, element)
{
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