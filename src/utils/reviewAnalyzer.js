const axios = require('axios');
const QuickChart = require('quickchart-js');
const { LPQ_LOCATION_IDS, SOURCE_IDS, COMPANY_ID } = require('./constants');

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
            location_id: locationIds,
            thirdPartyReviewSourcesId: sourceIds,
            companyId: [COMPANY_ID]
        };

        console.log('Making API call with payload:', JSON.stringify(payload, null, 2));
        console.log('API URL:', 'https://reviewanalyser.obenan.com/chat');

        // Make API call with timeout and headers
        const response = await axios.post('https://reviewanalyser.obenan.com/chat', payload, {
            timeout: 30000, // 30 second timeout
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        console.log('API Response Status:', response.status);
        console.log('API Response Headers:', JSON.stringify(response.headers, null, 2));
        console.log('API Response Data:', JSON.stringify(response.data, null, 2));

        // Validate response structure
        if (!response.data) {
            throw new Error('Empty response from API');
        }

        if (!response.data.response) {
            throw new Error('No response field in API data');
        }

        let result = {
            text: response.data.response,
            hasGraph: false
        };

        // Only process graph data if it exists
        if (response.data.graph_response && response.data.graph_response.data) {
            const graphData = response.data.graph_response;
            
            // Check if we have valid data for the chart
            if (Array.isArray(graphData.data) && graphData.data.length > 0) {
                console.log('Processing graph data:', JSON.stringify(graphData.data, null, 2));
                
                const chart = new QuickChart();
                
                chart.setConfig({
                    type: 'bar',
                    data: {
                        labels: graphData.data.map(item => item.Date),
                        datasets: [{
                            label: 'Number of Posts',
                            data: graphData.data.map(item => item["Number of Posts"]),
                            backgroundColor: 'rgba(82, 130, 255, 0.8)',
                            borderColor: 'rgb(82, 130, 255)',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    stepSize: 1
                                }
                            }
                        },
                        plugins: {
                            title: {
                                display: true,
                                text: 'Posts by Date'
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
        console.error('Error in analyzeReviews:', {
            message: error.message,
            stack: error.stack,
            response: error.response?.data,
            status: error.response?.status,
            request: {
                url: error.config?.url,
                data: error.config?.data,
                headers: error.config?.headers
            }
        });

        // Return more specific error messages
        if (error.message.includes('timeout')) {
            throw new Error('The review analysis service is taking too long to respond. Please try again.');
        } else if (error.response?.status === 404) {
            throw new Error('Could not connect to the review analyzer service. Please try again later.');
        } else if (error.message.includes('No valid location')) {
            throw new Error('Please select valid locations before analyzing reviews.');
        } else if (error.message.includes('No valid source')) {
            throw new Error('Please select valid review sources before analyzing reviews.');
        } else if (error.response?.status === 400) {
            throw new Error('Invalid request. Please check your selections and try again.');
        } else {
            throw new Error('Error analyzing reviews. Please try again or contact support if the issue persists.');
        }
    }
}

module.exports = { analyzeReviews };
