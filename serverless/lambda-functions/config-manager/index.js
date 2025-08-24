const AWS = require('aws-sdk');
const dynamoDb = new AWS.DynamoDB.DocumentClient();

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    try {
        const { httpMethod, path, body } = event;
        
        // Handle OPTIONS requests for CORS
        if (httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: ''
            };
        }
        
        let result;
        
        switch (httpMethod) {
            case 'GET':
                if (path === '/api/config') {
                    result = await getConfig();
                } else {
                    throw new Error(`Unsupported path: ${path}`);
                }
                break;
                
            case 'POST':
                if (path === '/api/directories') {
                    const requestBody = JSON.parse(body);
                    result = await addDirectory(requestBody);
                } else {
                    throw new Error(`Unsupported path: ${path}`);
                }
                break;
                
            case 'DELETE':
                if (path === '/api/directories') {
                    const requestBody = JSON.parse(body);
                    result = await removeDirectory(requestBody);
                } else {
                    throw new Error(`Unsupported path: ${path}`);
                }
                break;
                
            case 'PUT':
                if (path === '/api/directories') {
                    const requestBody = JSON.parse(body);
                    result = await updateDirectories(requestBody);
                } else {
                    throw new Error(`Unsupported path: ${path}`);
                }
                break;
                
            default:
                throw new Error(`Unsupported method: ${httpMethod}`);
        }
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                ...CORS_HEADERS
            },
            body: JSON.stringify(result)
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

async function getConfig() {
    try {
        const params = {
            TableName: process.env.CONFIG_TABLE,
            Key: { configKey: 'directories' }
        };
        
        const result = await dynamoDb.get(params).promise();
        
        if (result.Item) {
            return {
                directories: result.Item.directories || [],
                lastUpdated: result.Item.lastUpdated
            };
        } else {
            // Return default configuration
            const defaultConfig = {
                directories: [
                    '/mnt/f/utility-projects/project-tracker',
                    '/mnt/f/utility-projects/fundo-matic'
                ],
                lastUpdated: new Date().toISOString()
            };
            
            // Save default config to DynamoDB
            await saveConfig('directories', defaultConfig);
            return defaultConfig;
        }
    } catch (error) {
        console.error('Error getting config:', error);
        throw error;
    }
}

async function addDirectory(requestBody) {
    const { directory } = requestBody;
    
    if (!directory) {
        throw new Error('Directory path is required');
    }
    
    // Get current directories
    const config = await getConfig();
    const directories = config.directories || [];
    
    // Add directory if not already present
    if (!directories.includes(directory)) {
        directories.push(directory);
        
        const updatedConfig = {
            directories,
            lastUpdated: new Date().toISOString()
        };
        
        await saveConfig('directories', updatedConfig);
        
        return {
            message: 'Directory added successfully',
            directories: updatedConfig.directories
        };
    } else {
        return {
            message: 'Directory already exists',
            directories
        };
    }
}

async function removeDirectory(requestBody) {
    const { directory } = requestBody;
    
    if (!directory) {
        throw new Error('Directory path is required');
    }
    
    // Get current directories
    const config = await getConfig();
    const directories = config.directories || [];
    
    // Remove directory
    const updatedDirectories = directories.filter(dir => dir !== directory);
    
    if (updatedDirectories.length !== directories.length) {
        const updatedConfig = {
            directories: updatedDirectories,
            lastUpdated: new Date().toISOString()
        };
        
        await saveConfig('directories', updatedConfig);
        
        return {
            message: 'Directory removed successfully',
            directories: updatedConfig.directories
        };
    } else {
        return {
            message: 'Directory not found',
            directories
        };
    }
}

async function updateDirectories(requestBody) {
    const { directories } = requestBody;
    
    if (!Array.isArray(directories)) {
        throw new Error('Directories must be an array');
    }
    
    const updatedConfig = {
        directories,
        lastUpdated: new Date().toISOString()
    };
    
    await saveConfig('directories', updatedConfig);
    
    return {
        message: 'Directories updated successfully',
        directories: updatedConfig.directories
    };
}

async function saveConfig(configKey, configData) {
    const params = {
        TableName: process.env.CONFIG_TABLE,
        Item: {
            configKey,
            ...configData
        }
    };
    
    return await dynamoDb.put(params).promise();
}