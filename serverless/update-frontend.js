#!/usr/bin/env node

/**
 * Frontend API Configuration Update Script
 * Updates the frontend HTML files to use API Gateway endpoints instead of localhost
 */

const fs = require('fs');
const path = require('path');

// Configuration
const API_GATEWAY_URL = process.env.API_GATEWAY_URL || process.argv[2];
const LOCAL_API_URL = 'http://localhost:3001';

if (!API_GATEWAY_URL) {
    console.error('❌ Please provide API Gateway URL:');
    console.error('   node update-frontend.js https://abc123.execute-api.us-east-1.amazonaws.com/dev');
    console.error('   or set API_GATEWAY_URL environment variable');
    process.exit(1);
}

console.log('🔄 Updating frontend configuration...');
console.log(`   From: ${LOCAL_API_URL}`);
console.log(`   To:   ${API_GATEWAY_URL}`);

const htmlFiles = [
    'project-tracker.html',
    'claude-tracker.html',
    'git-tracker.html'
];

let updatedFiles = 0;

htmlFiles.forEach(filename => {
    const filePath = path.join('..', filename);
    
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  File not found: ${filename}`);
        return;
    }
    
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Replace the API configuration to use serverless endpoint
        const originalContent = content;
        
        // Add API URL configuration at the start of the script section
        content = content.replace(
            /<script>\s*\n/,
            `<script>
        // Serverless API Configuration
        window.PROJECT_TRACKER_API_URL = '${API_GATEWAY_URL}/api';
`
        );
        
        // Also replace any hardcoded localhost references as backup
        content = content.replace(
            new RegExp(LOCAL_API_URL.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&'), 'g'),
            `${API_GATEWAY_URL}/api`
        );
        
        if (content !== originalContent) {
            fs.writeFileSync(filePath, content);
            console.log(`✅ Updated: ${filename}`);
            updatedFiles++;
        } else {
            console.log(`🔍 No changes needed: ${filename}`);
        }
        
    } catch (error) {
        console.error(`❌ Error updating ${filename}:`, error.message);
    }
});

console.log(`\n📊 Summary: Updated ${updatedFiles} files`);

if (updatedFiles > 0) {
    console.log('\n🎯 Next steps:');
    console.log('1. Test the updated frontend locally');
    console.log('2. Deploy frontend to AWS Amplify');
    console.log('3. Verify all API endpoints are working');
    
    // Create a simple test script
    console.log('\n🧪 Test your API endpoints:');
    htmlFiles.forEach(file => {
        console.log(`   open ${file}`);
    });
} else {
    console.log('\n💡 Frontend files may already be configured for serverless deployment');
}

// Save configuration for reference
const config = {
    apiGatewayUrl: API_GATEWAY_URL,
    updatedAt: new Date().toISOString(),
    updatedFiles: updatedFiles,
    htmlFiles: htmlFiles
};

fs.writeFileSync('frontend-update-log.json', JSON.stringify(config, null, 2));
console.log('\n📝 Configuration saved to frontend-update-log.json');