exports.handler = async (event) => {
    const response = {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET,OPTIONS'
        },
        body: JSON.stringify({
            status: 'OK',
            service: 'Project Tracker Backend - Serverless',
            version: '2.0.0',
            timestamp: new Date().toISOString(),
            test: 'Stack reset - testing deployment',
            environment: process.env.ENVIRONMENT || 'dev',
            lambda: true
        })
    };
    
    return response;
};