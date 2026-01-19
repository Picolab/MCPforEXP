/*
    get_manifold_pico(eci: string)
        Takes in the ECI of the manifold owner
        Returns the info of the manifold pico as a javascript object:
            { 
                eci: [manifold pico's system/child ECI as a string],
                name: "Manifold",
                parent_eci: [owner pico's system/parent ECI as a string]
            }
*/

async function get_manifold_pico(eci) {
    try {
        const response = await fetch(`http://localhost:3000/sky/cloud/${eci}/io.picolabs.manifold_owner/getManifoldPico`);

        // Sending the query with an invalid eci returns a 304 code with the following object: {"error":"Error: ECI not found ${eci}"}. This still counts as an ok response.
        if (!response.ok) {
            throw new Error(`${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Fetch error:", error);
    }
}

module.exports = { get_manifold_pico };