/**
 * Retrieve Work Orders from Big Query that have been added to the work log during the previous 7 days
 */
function getWeekWorkOrders() {
    const projectId = 'golden-memory-498115-q3';
    const request = {
        query: `SELECT * FROM current_work_log.work_orders_all 
                    WHERE auto_timestamp >= TIMESTAMP(DATE_SUB(CURRENT_DATE('America/Toronto'), INTERVAL 7 DAY))
                    ORDER BY auto_timestamp DESC`,
        useLegacySql: false
    };

    let queryResults = BigQuery.Jobs.query(request, projectId);
    const jobId = queryResults.jobReference.jobId;

    // Check on status of the Query Job.
    let sleepTimeMs = 500;
    while (!queryResults.jobComplete) {
        Utilities.sleep(sleepTimeMs);
        sleepTimeMs *= 2;
        queryResults = BigQuery.Jobs.getQueryResults(projectId, jobId);
    }

    // Get all the rows of results.
    let rows = queryResults.rows || [];
    while (queryResults.pageToken) {
        queryResults = BigQuery.Jobs.getQueryResults(projectId, jobId, {
            pageToken: queryResults.pageToken,
        });
        rows = rows.concat(queryResults.rows);
    }

    // transform results into 2D array
    const values = rows.map(row =>
        row.f.map(field => field.v === null ? '' : field.v)
    );

    return values;
}

/**
 * Send an email report of work orders from the last week to specified recipients
 */
function sendWeeklyEmail() {
    let summaryTable =
        `<h2>Work Orders pushed to Inventory in the last week</h2>
    <table border="1" cellpadding="6" cellspacing="0">
    <tr>
      <th>Work Order Report Link</th>
      <th>Operator</th>
      <th>Email</th>
      <th>Timestamp</th>
      <th>Date</th>
      <th>Subject</th>
      <th>Operation</th>
      <th>Category</th>
      <th>Operation Detail</th>
      <th>Total Input Weight</th>
      <th>Total Cannabis</th>
      <th>Total Non-Cannabis</th>
      <th>Total Output Weight</th>
      <th>Total Usable Output</th>
      <th>Total Processing Loss</th>
      <th>Total Destruction Weight</th>
    </tr>
    `
    const workOrders = getWeekWorkOrders();
    console.log(workOrders);

    for (let i = 0; i < workOrders.length; i++) {
        let w = workOrders[i];
        summaryTable +=
            `<tr>
      <th><a href="https://script.google.com/a/macros/growtown.ca/s/AKfycbzqilQMz4iWbTdVFiqWw0Sh8v3Pn16gL9kZfBttkvgqCoq7WHX3gwOSMz6QF2geOI1C_A/exec?paramKey=${w[0]}">${w[0]}</th>
      <th>${w[1]}</th>
      <th>${w[2]}</th>
      <th>${getTimeStamp(w[3])}</th>
      <th>${w[4]}</th>
      <th>${w[5]}</th>
      <th>${w[6]}</th>
      <th>${w[7]}</th>
      <th>${w[8]}</th>
      <th>${w[9]}</th>
      <th>${w[10]}</th>
      <th>${w[11]}</th>
      <th>${w[12]}</th>
      <th>${w[13]}</th>
      <th>${w[14]}</th>
      <th>${w[15]}</th>
    </tr>`
    }

    summaryTable += `</table>`;

    const today = new Date();

    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const timeZone = "America/Toronto";

    const formatToday = Utilities.formatDate(today, timeZone, "yyyy-MM-dd");

    const formatLastWeek = Utilities.formatDate(lastWeek, timeZone, "yyyy-MM-dd");

    recipients = `${EMAILS.Dev}, ${EMAILS.QA}, ${EMAILS.QC}, ${EMAILS.CEO}`;
    GmailApp.sendEmail(recipients, "Work Orders from the last week: " + formatLastWeek + " - " + formatToday, "", { htmlBody: summaryTable });
}

/**
 * Convert timestamp into formatted string
 */
function getTimeStamp(rawTimestamp) {
    let formattedTimestamp = "N/A";
    if (rawTimestamp) {
        const epochMillis = Number(rawTimestamp) * 1000;
        const dateObject = new Date(epochMillis);

        formattedTimestamp = Utilities.formatDate(dateObject, "EDT", "yyyy-MM-dd HH:mm:ss");
    }
    return formattedTimestamp;
}
