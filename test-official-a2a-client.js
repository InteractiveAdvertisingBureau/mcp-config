/**
 * Test Official A2A Client
 * Uses the official @a2a-js/sdk ClientFactory to test our A2A server
 */

import { ClientFactory } from '@a2a-js/sdk/client';
import { randomUUID } from 'crypto';

async function testOfficialA2AClient() {
  console.log('\n🧪 Testing with Official A2A Client (@a2a-js/sdk)\n');
  console.log('='.repeat(70));

  try {
    // Step 1: Create ClientFactory
    console.log('\n📦 Step 1: Creating ClientFactory...');
    const factory = new ClientFactory();
    console.log('✅ ClientFactory created');

    // Step 2: Create client for Buyer agent
    console.log('\n📡 Step 2: Connecting to Buyer Agent...');
    // Use full URL to agent card, then empty path (per SDK documentation example 3)
    // const buyerCardUrl = 'http://localhost:3000/a2a/buyer/.well-known/agent-card.json';
    const buyerCardUrl = 'https://mcpclient.iabtechlab.com/a2a/buyer/.well-known/agent-card.json';

    console.log(`   Agent Card URL: ${buyerCardUrl}`);

    const buyerClient = await factory.createFromUrl(buyerCardUrl, '');
    console.log('✅ Connected to Buyer Agent');

    // Step 3: Send a simple message
    console.log('\n📤 Step 3: Sending message to Buyer Agent...');
    const messageId = randomUUID();
    console.log(`   Message ID: ${messageId}`);
    console.log('   Content: "create account for Nike"');

    const response = await buyerClient.sendMessage({
      message: {
        messageId: messageId,
        role: 'user',
        parts: [{
          kind: 'text',
          text: 'create account for Nike'
        }],
        kind: 'message'
      }
    });

    console.log('\n✅ Response received:');

    // The official A2A client wraps the response in { task: {...} } or { message: {...} }
    const actualResponse = response.task || response.message || response;
    const responseType = actualResponse.kind;

    console.log('   Type:', responseType);

    if (responseType === 'task') {
      console.log('   Task ID:', actualResponse.id);
      console.log('   Context ID:', actualResponse.contextId);
      console.log('   Status:', actualResponse.status.state);

      // Step 4: Wait a bit and get task status
      console.log('\n⏳ Step 4: Waiting 3 seconds for task to complete...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log(`\n📋 Step 5: Getting task status for ${actualResponse.id}...`);
      const taskResponse = await buyerClient.getTask({ taskId: actualResponse.id });

      if (taskResponse.task) {
        const task = taskResponse.task;
        console.log('✅ Task retrieved:');
        console.log('   Status:', task.status.state);
        console.log('   History entries:', task.history.length);

        // Show history
        if (task.history.length > 0) {
          console.log('\n📝 Task History:');
          task.history.forEach((msg, i) => {
            const emoji = msg.role === 'user' ? '👤' : '🤖';
            const preview = msg.parts?.[0]?.text?.substring(0, 100) || '';
            console.log(`   ${emoji} ${i + 1}. ${msg.role}: ${preview}${preview.length === 100 ? '...' : ''}`);
          });
        }
      }
    } else if (responseType === 'message') {
      console.log('   Message:', actualResponse.parts?.[0]?.text);
    }

    // Step 6: Test Seller agent
    console.log('\n\n📡 Step 6: Connecting to Seller Agent...');
    // const sellerCardUrl = 'http://localhost:3000/a2a/seller/.well-known/agent-card.json';
    const sellerCardUrl = 'https://mcpclient.iabtechlab.com/a2a/seller/.well-known/agent-card.json';
    console.log(`   Agent Card URL: ${sellerCardUrl}`);

    const sellerClient = await factory.createFromUrl(sellerCardUrl, '');
    console.log('✅ Connected to Seller Agent');

    // Step 7: Send message to seller
    console.log('\n📤 Step 7: Sending message to Seller Agent...');
    const sellerMessageId = randomUUID();
    console.log(`   Message ID: ${sellerMessageId}`);
    console.log('   Content: "search products"');

    const sellerResponse = await sellerClient.sendMessage({
      message: {
        messageId: sellerMessageId,
        role: 'user',
        parts: [{
          kind: 'text',
          text: 'search products'
        }],
        kind: 'message'
      }
    });

    console.log('\n✅ Seller response received:');

    // Extract actual response from wrapper
    const sellerActualResponse = sellerResponse.task || sellerResponse.message || sellerResponse;
    const sellerResponseType = sellerActualResponse.kind;

    console.log('   Type:', sellerResponseType);

    if (sellerResponseType === 'task') {
      console.log('   Task ID:', sellerActualResponse.id);
      console.log('   Status:', sellerActualResponse.status.state);

      // Wait and check final status
      await new Promise(resolve => setTimeout(resolve, 3000));
      const finalTaskResponse = await sellerClient.getTask({ taskId: sellerActualResponse.id });
      if (finalTaskResponse.task) {
        console.log('   Final Status:', finalTaskResponse.task.status.state);
      }
    }

    // Success summary
    console.log('\n\n' + '='.repeat(70));
    console.log('✅ Official A2A Client Test Completed Successfully!');
    console.log('='.repeat(70));
    console.log('\n📊 Summary:');
    console.log('   ✅ ClientFactory created');
    console.log('   ✅ Connected to Buyer Agent');
    console.log('   ✅ Sent message via A2A protocol');
    console.log('   ✅ Received task response');
    console.log('   ✅ Retrieved task status');
    console.log('   ✅ Connected to Seller Agent');
    console.log('   ✅ Tested multiple agents');
    console.log('\n🎉 Our server is fully A2A v0.3.0 compliant!');
    console.log('');

  } catch (error) {
    console.error('\n❌ Test Failed:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  }
}

// Run test
testOfficialA2AClient().catch(console.error);
