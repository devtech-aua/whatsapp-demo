const axios = require('axios');
const QuickChart = require('quickchart-js');
const { LPQ_LOCATION_IDS, SOURCE_IDS, COMPANY_ID } = require('./constants');

// API endpoint configuration
const API_CONFIG = {
    baseURL: process.env.REVIEW_ANALYZER_API_URL || 'https://reviewanalyser.obenan.com',
    endpoint: '/chat',
    timeout: 30000
};

async function analyzeReviews(locations, sources, prompt = "when was the last review posted") {
    try {
        // Input validation
        if (!locations || !Array.isArray(locations) || locations.length === 0) {
            throw new Error('No locations provided');
        }
        if (!sources || !Array.isArray(sources) || sources.length === 0) {
            throw new Error('No sources provided');
        }

        // Convert location names to IDs
        const locationIds = locations.map(loc => LPQ_LOCATION_IDS[loc]).filter(id => id);
        if (locationIds.length === 0) {
            throw new Error('No valid location IDs found');
        }
        
        // Convert source names to IDs
        const sourceIds = sources.map(src => SOURCE_IDS[src]).filter(id => id);
        if (sourceIds.length === 0) {
            throw new Error('No valid source IDs found');
        }

        // Prepare request payload
        const payload = {
            prompt,
            location_ids: locationIds,
            source_ids: sourceIds,
            company_id: COMPANY_ID,
            language: 'en'
        };

        const apiUrl = `${API_CONFIG.baseURL}${API_CONFIG.endpoint}`;
        console.log('Making API call to:', apiUrl);
        console.log('With payload:', JSON.stringify(payload, null, 2));

        // Make API call with retry logic
        let retries = 3;
        let lastError;

        while (retries > 0) {
            try {
                console.log(`API call attempt ${4 - retries}`);
                const response = await axios({
                    method: 'post',
                    url: apiUrl,
                    data: payload,
                    timeout: API_CONFIG.timeout,
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    validateStatus: function (status) {
                        return status >= 200 && status < 500; // Accept any status code less than 500
                    }
                });

                console.log(`API Response (Attempt ${4 - retries}):`);
                console.log('Status:', response.status);
                console.log('Headers:', JSON.stringify(response.headers, null, 2));
                console.log('Raw Response Data:', JSON.stringify(response.data, null, 2));

                // Check for error status codes
                if (response.status !== 200) {
                    throw new Error(`API returned status ${response.status}: ${JSON.stringify(response.data)}`);
                }

                // Validate response structure
                if (!response.data) {
                    throw new Error('Empty response from API');
                }

                // Check if response indicates an error or misunderstanding
                if (response.data.error) {
                    throw new Error(`API Error: ${response.data.error}`);
                }

                if (!response.data.response && !response.data.answer) {
                    throw new Error('No valid response field in API data');
                }

                let result = {
                    text: response.data.response || response.data.answer,
                    hasGraph: false
                };

                // Only process graph data if it exists and is valid
                if (response.data.graph_data || response.data.graphData) {
                    const graphData = response.data.graph_data || response.data.graphData;
                    
                    // Check if we have valid data for the chart
                    if (graphData && Array.isArray(graphData) && graphData.length > 0) {
                        console.log('Processing graph data:', JSON.stringify(graphData, null, 2));
                        
                        const chart = new QuickChart();
                        
                        chart.setConfig({
                            type: 'bar',
                            data: {
                                labels: graphData.map(item => item.date || item.Date),
                                datasets: [{
                                    label: 'Rating',
                                    data: graphData.map(item => item.rating || item.Rating || item.value || item.Value),
                                    backgroundColor: 'rgba(82, 130, 255, 0.8)',
                                    borderColor: 'rgb(82, 130, 255)',
                                    borderWidth: 1
                                }]
                            },
                            options: {
                                scales: {
                                    y: {
                                        beginAtZero: true,
                                        max: 5,
                                        ticks: {
                                            stepSize: 1
                                        }
                                    }
                                },
                                plugins: {
                                    title: {
                                        display: true,
                                        text: 'Average Rating Over Time'
                                    }
                                }
                            }
                        });
                        
                        // Set chart size
                        chart.setWidth(800);
                        chart.setHeight(400);
                        
                        try {
                            // Get chart URL with timeout
                            result.chartUrl = await Promise.race([
                                chart.getShortUrl(),
                                new Promise((_, reject) => 
                                    setTimeout(() => reject(new Error('Chart generation timeout')), 15000)
                                )
                            ]);
                            result.hasGraph = true;
                            console.log('Generated chart URL:', result.chartUrl);
                        } catch (chartError) {
                            console.error('Error generating chart:', chartError);
                            // Continue without chart if there's an error
                        }
                    }
                }
                
                return result;
            } catch (error) {
                console.error(`API call attempt ${4 - retries} failed:`, {
                    message: error.message,
                    status: error.response?.status,
                    data: error.response?.data,
                    code: error.code,
                    stack: error.stack
                });
                lastError = error;
                retries--;
                if (retries > 0) {
                    console.log(`Retrying in 2 seconds... (${retries} attempts remaining)`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }

        throw lastError;
    } catch (error) {
        console.error('Error in analyzeReviews:', {
            message: error.message,
            stack: error.stack,
            response: error.response?.data,
            status: error.response?.status,
            code: error.code,
            request: error.config ? {
                url: error.config.url,
                data: error.config.data,
                headers: error.config.headers
            } : undefined
        });

        throw error;
    }
}

module.exports = { analyzeReviews };
