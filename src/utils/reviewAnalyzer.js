const axios = require('axios');
const QuickChart = require('quickchart-js');
const { LPQ_LOCATION_IDS, SOURCE_IDS, COMPANY_ID } = require('./constants');

async function analyzeReviews(locations, sources, prompt = "when was the last review posted") {
    try {
        // Convert location names to IDs
        const locationIds = locations.map(loc => LPQ_LOCATION_IDS[loc]).filter(id => id);
        
        // Convert source names to IDs
        const sourceIds = sources.map(src => SOURCE_IDS[src]).filter(id => id);

        // Prepare request payload
        const payload = {
            prompt,
            location_id: locationIds,
            thirdPartyReviewSourcesId: sourceIds,
            companyId: [COMPANY_ID]
        };

        console.log('Making API call with payload:', JSON.stringify(payload, null, 2));

        // Make API call
        const response = await axios.post('https://reviewanalyser.obenan.com/process-query/', payload);
        
        console.log('API Response:', JSON.stringify(response.data, null, 2));

        // Check if we have a valid response
        if (!response.data || !response.data.response) {
            throw new Error('Invalid response format from API');
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
                
                // Get chart URL
                result.chartUrl = await chart.getShortUrl();
                result.hasGraph = true;
            }
        }
        
        return result;
    } catch (error) {
        console.error('Error in analyzeReviews:', error);
        console.error('Error details:', {
            message: error.message,
            response: error.response?.data,
            request: error.config
        });
        throw error;
    }
}

module.exports = { analyzeReviews };
