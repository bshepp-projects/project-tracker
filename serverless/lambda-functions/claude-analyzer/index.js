const AWS = require('aws-sdk');
const dynamoDb = new AWS.DynamoDB.DocumentClient();

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,OPTIONS'
};

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    try {
        const { httpMethod } = event;
        
        // Handle OPTIONS requests for CORS
        if (httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: ''
            };
        }
        
        // Get all cached projects and filter for Claude-enabled ones
        const allProjects = await getAllCachedProjects();
        const claudeProjects = allProjects.filter(project => 
            project.hasClaudeFile || project.hasClaude
        );
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                ...CORS_HEADERS
            },
            body: JSON.stringify(claudeProjects)
        };
        
    } catch (error) {
        console.error('Error:', error);
        
        return {
            statusCode: error.statusCode || 500,
            headers: {
                'Content-Type': 'application/json',
                ...CORS_HEADERS
            },
            body: JSON.stringify({
                error: error.message || 'Internal server error'
            })
        };
    }
};

async function getAllCachedProjects() {
    try {
        const params = {
            TableName: process.env.PROJECTS_TABLE
        };
        
        const result = await dynamoDb.scan(params).promise();
        
        // Filter out expired items
        const now = Math.floor(Date.now() / 1000);
        const validProjects = result.Items.filter(item => !item.ttl || item.ttl > now);
        
        return validProjects.map(item => ({
            ...item,
            ttl: undefined // Remove internal field
        }));
    } catch (error) {
        console.error('Error getting cached projects:', error);
        return [];
    }
}