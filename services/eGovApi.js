// eGovAI

export async function processReportDescription(description, location) {
    const baseUrl = import.meta.env.VITE_EGOV_AI_URL;
    const endpoint = `${baseUrl}/api/v1/egov/integration/ai_assistant/generate`;
    const accessToken = await generateAccessToken();

    const systemPrompt = 
    `You are an expert text analyzer. I will provide you with a string of text, and you must perform the following tasks:

    1. Analyze the content of the provided string.
    2. Determine the report type based on the content. You must choose *only one* from the following exact list: Crime, Red Tape, Scam, Child Abuse, Women Abuse, Overpricing, Fire, Accident, Gas Station Concerns.
    3. Based on the determined report type, assign the appropriate agency or agencies from the list below:
       - Crime: PNP, NBI
       - Red Tape: ARTA
       - Scam: CICC, PNP-ACG, NBI, SEC
       - Child Abuse: DSWD, PNP-WCPC, CWC
       - Women Abuse: PNP-WCPC, PCW, DSWD
       - Overpricing: DTI, DOE
       - Fire: BFP
       - Accident: Emergency 911, MMDA, LGUs
       - Gas Station Concerns: DOE, DTI
    4. Create a title that is short, concise, and highly descriptive of the issue.
    5. Write a concise summary of the main points in the text.

    Output Format Constraint:
    1. You must return your final answer STRICTLY in the exact format shown below. Do not include any conversational filler, labels, line breaks between brackets, or extra spaces.
    2. Refer to the user as the "complainant" in your summary.
    3. For the Assigned Agency field, list the agency abbreviations separated by commas if there are multiple.

    [Report Type][Assigned Agency][Title][Summary]

    Location: ${location || "Not specified"}
    Input Text:
    ${description}`;

    try {
        const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            prompt: systemPrompt,
            category: "GLOBAL"
        })
        });

        if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const parsedData = parseReportString(data.data);
        console.log("Parsed AI Scan:", parsedData);
        
        const eReportSubmission = await submitReport({ // reportData: {description, reportType, assignedAgency, title, summary}
            description: description,
            reportType: parsedData.reportType,
            assignedAgency: parsedData.assignedAgency,
            title: parsedData.title,
            summary: parsedData.summary
        });
        const caseNumber = eReportSubmission.case_number;
        console.log("eReport Submission Response:", eReportSubmission);

        return {
            caseNumber,
            reportType: parsedData.reportType,
            assignedAgency: parsedData.assignedAgency,
            title: parsedData.title,
            summary: parsedData.summary
        };
        /*
            reportType: match[1].trim(),
            assignedAgency: match[2].trim(),
            title: match[3].trim(),
            summary: match[4].trim()
        */

    } catch (error) {
        console.error("Failed to generate AI response:", error);
        throw error;
    }
}

async function generateAccessToken(){
    const baseUrl = import.meta.env.VITE_EGOV_AI_URL;
    const endpoint = `${baseUrl}/api/v1/egov/integration/token`;
    const accessCode = import.meta.env.VITE_EGOV_AI_ACCESS_CODE;

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                access_code: accessCode
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();

        return data.access_token;
    } catch (error) {
        console.error("Failed to generate access token:", error);
        throw error;
    }
}

// eReport

async function submitReport(reportData){ // reportData: {description, reportType, assignedAgency, title, summary}
    const baseUrl = import.meta.env.VITE_EREPORT_URL;
    const endpoint = `${baseUrl}/api/integration/submit_complaint`;
    const accessToken = await generateEReportToken(); 

        try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                mobile: "639999999999",
                first_name: "Juan",
                last_name: "Dela Cruz",
                gender: "Male",
                complainant_email: "juan.delacruz@email.com",
                report_type: reportData.reportType.toLowerCase(),
                subject: reportData.title,
                message: reportData.summary,
                region_code: "040000000",
                province_code: "042100000",
                municipality_code: "042111000",
                barangay_code: "042111011",
                latitude: "14.60",
                longitude: "120.98"
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();

        return data;
    } catch (error) {
        console.error("Failed to submit report:", error);
        throw error;
    }
}

async function generateEReportToken(){
    const baseUrl = import.meta.env.VITE_EREPORT_URL;
    const endpoint = `${baseUrl}/api/integration/token`;
    const accessCode = import.meta.env.VITE_EREPORT_ACCESS_TOKEN;

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                access_code: accessCode
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();

        return data.access_token;
    } catch (error) {
        console.error("Failed to generate access token for eReport:", error);
        throw error;
    }
}



// === UTILITIES === //

function parseReportString(responseString) {
  const regex = /\[([^\]]+)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]\s*\[([\s\S]*?)\]/;
  
  const match = responseString.match(regex);

  if (!match) {
    throw new Error("Failed to parse: String does not match the expected format.");
  }

  return {
    reportType: match[1].trim(),
    assignedAgency: match[2].trim(),
    title: match[3].trim(),
    summary: match[4].trim()
  };
}