const API_URL = "https://script.google.com/macros/s/AKfycbzciPZ8Q5ukwJhUacYgzcHuByQy-QbeEL7AnYTUnMOx6LqCHq8ikSjtKlk6cUo6gB_7Qg/exec";
const MASTER_SHEET = "Master";

async function checkMasterOptions() {
    console.log("Fetching Master sheet options...");
    try {
        const resp = await fetch(`${API_URL}?sheet=${MASTER_SHEET}`);
        const result = await resp.json();
        if (result.success && result.data) {
            // Check Column L (index 11) for Page Access types
            const pageOptions = result.data.slice(1).map(row => row[11]).filter(Boolean);
            console.log("Page Access Options (Col L):", JSON.stringify([...new Set(pageOptions)]));
            console.log("Current Headers:", JSON.stringify(result.data[0]));
        } else {
            console.log("Failed to fetch Master sheet.");
        }
    } catch (err) {
        console.error("Error:", err);
    }
}

checkMasterOptions();
