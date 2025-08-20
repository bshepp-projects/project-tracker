const AWS = require('aws-sdk');
const dynamoDb = new AWS.DynamoDB.DocumentClient();

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS'
};

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    try {
        const { httpMethod, path, body, pathParameters } = event;
        
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
                if (path === '/api/tags') {
                    result = await getAllTags();
                } else {
                    throw new Error(`Unsupported path: ${path}`);
                }
                break;
                
            case 'POST':
                if (path.startsWith('/api/projects/') && path.endsWith('/tags')) {
                    const projectPath = decodeURIComponent(pathParameters.projectPath);
                    const requestBody = JSON.parse(body);
                    result = await updateProjectTags(projectPath, requestBody);
                } else {
                    throw new Error(`Unsupported path: ${path}`);
                }
                break;
                
            case 'DELETE':
                if (path.startsWith('/api/tags/')) {
                    const tagName = decodeURIComponent(pathParameters.tagName);
                    result = await deleteTag(tagName);
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

async function getAllTags() {
    try {
        // Get unique tags from projects table
        const params = {
            TableName: process.env.PROJECTS_TABLE,
            ProjectionExpression: 'tags'
        };
        
        const result = await dynamoDb.scan(params).promise();
        const tagCounts = {};
        
        result.Items.forEach(item => {
            if (item.tags && Array.isArray(item.tags)) {
                item.tags.forEach(tag => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            }
        });
        
        // Convert to array format expected by frontend
        const tags = Object.entries(tagCounts).map(([name, count]) => ({
            name,
            count
        }));
        
        return tags.sort((a, b) => b.count - a.count);
    } catch (error) {
        console.error('Error getting tags:', error);
        throw error;
    }
}

async function updateProjectTags(projectPath, requestBody) {
    try {
        const { tags } = requestBody;
        
        if (!Array.isArray(tags)) {
            throw new Error('Tags must be an array');
        }
        
        // Update project in projects table
        const params = {
            TableName: process.env.PROJECTS_TABLE,
            Key: { projectPath },
            UpdateExpression: 'SET tags = :tags, lastUpdated = :lastUpdated',
            ExpressionAttributeValues: {
                ':tags': tags,
                ':lastUpdated': new Date().toISOString()
            },
            ReturnValues: 'ALL_NEW'
        };
        
        const result = await dynamoDb.update(params).promise();
        
        // Also update tags table for relationships
        await updateTagRelationships(projectPath, tags);
        
        return {
            message: 'Project tags updated successfully',
            project: result.Attributes
        };
    } catch (error) {
        console.error('Error updating project tags:', error);
        throw error;
    }
}

async function updateTagRelationships(projectPath, tags) {
    try {
        // First, remove all existing tag relationships for this project
        await removeAllTagRelationships(projectPath);
        
        // Then add new relationships
        for (const tagName of tags) {
            const params = {
                TableName: process.env.TAGS_TABLE,
                Item: {
                    tagName,
                    projectPath,
                    createdAt: new Date().toISOString()
                }
            };
            
            await dynamoDb.put(params).promise();
        }
    } catch (error) {
        console.error('Error updating tag relationships:', error);
        // Don't throw - this is supplementary data
    }
}

async function removeAllTagRelationships(projectPath) {
    try {
        // Query all tags for this project
        const queryParams = {
            TableName: process.env.TAGS_TABLE,
            IndexName: 'ProjectPathIndex', // Would need to create this GSI
            KeyConditionExpression: 'projectPath = :projectPath',
            ExpressionAttributeValues: {
                ':projectPath': projectPath
            }
        };
        
        // For now, scan the table (inefficient but works)
        const scanParams = {
            TableName: process.env.TAGS_TABLE,
            FilterExpression: 'projectPath = :projectPath',
            ExpressionAttributeValues: {
                ':projectPath': projectPath
            }
        };
        
        const result = await dynamoDb.scan(scanParams).promise();
        
        // Delete all found relationships
        for (const item of result.Items) {
            const deleteParams = {
                TableName: process.env.TAGS_TABLE,
                Key: {
                    tagName: item.tagName,
                    projectPath: item.projectPath
                }
            };
            
            await dynamoDb.delete(deleteParams).promise();
        }
    } catch (error) {
        console.error('Error removing tag relationships:', error);
        // Don't throw - this is cleanup
    }
}

async function deleteTag(tagName) {
    try {
        // Remove tag from all projects in projects table
        const projectsParams = {
            TableName: process.env.PROJECTS_TABLE,
            ProjectionExpression: 'projectPath, tags'
        };
        
        const projectsResult = await dynamoDb.scan(projectsParams).promise();
        
        let removedCount = 0;
        
        for (const project of projectsResult.Items) {
            if (project.tags && project.tags.includes(tagName)) {
                const updatedTags = project.tags.filter(tag => tag !== tagName);
                
                const updateParams = {
                    TableName: process.env.PROJECTS_TABLE,
                    Key: { projectPath: project.projectPath },
                    UpdateExpression: 'SET tags = :tags, lastUpdated = :lastUpdated',
                    ExpressionAttributeValues: {
                        ':tags': updatedTags,
                        ':lastUpdated': new Date().toISOString()
                    }
                };
                
                await dynamoDb.update(updateParams).promise();
                removedCount++;
            }
        }
        
        // Remove all tag relationships from tags table
        const tagsParams = {
            TableName: process.env.TAGS_TABLE,
            KeyConditionExpression: 'tagName = :tagName',
            ExpressionAttributeValues: {
                ':tagName': tagName
            }
        };
        
        const tagsResult = await dynamoDb.query(tagsParams).promise();
        
        for (const item of tagsResult.Items) {
            const deleteParams = {
                TableName: process.env.TAGS_TABLE,
                Key: {
                    tagName: item.tagName,
                    projectPath: item.projectPath
                }
            };
            
            await dynamoDb.delete(deleteParams).promise();
        }
        
        return {
            message: `Tag '${tagName}' deleted successfully`,
            removedFromProjects: removedCount
        };
    } catch (error) {
        console.error('Error deleting tag:', error);
        throw error;
    }
}