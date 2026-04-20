const API_URL = "https://script.google.com/macros/s/AKfycbzciPZ8Q5ukwJhUacYgzcHuByQy-QbeEL7AnYTUnMOx6LqCHq8ikSjtKlk6cUo6gB_7Qg/exec";
const MASTER_SHEET = "Master";

async function deepCheckMaster() {
    console.log("Fetching detailed Master sheet data...");
    try {
        const resp = await fetch(`${API_URL}?sheet=${MASTER_SHEET}`);
        const result = await resp.json();
        if (result.success && result.data) {
            console.log("Row 1 (Headers):", JSON.stringify(result.data[0]));
            // Show data from rows 2-10, focusing on columns A through L
            result.data.slice(1, 10).forEach((row, i) => {
                console.log(`Row ${i+2}:`, JSON.stringify(row));
            });
        }
    } catch (err) {
        console.error("Error:", err);
    }
}

deepCheckMaster();
