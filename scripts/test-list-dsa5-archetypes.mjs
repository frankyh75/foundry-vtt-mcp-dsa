import { FoundryClient } from '../packages/mcp-server/dist/foundry-client.js';
import { DSA5CharacterCreator } from '../packages/mcp-server/dist/systems/dsa5/character-creator.js';
import { Logger } from '../packages/mcp-server/dist/logger.js';

// Setup
const logger = new Logger({ level: 'info' });
const foundryConfig = {
  host: 'localhost',
  port: 31415,
  namespace: '/foundry-mcp',
  reconnectAttempts: 5,
  reconnectDelay: 1000,
};
const foundryClient = new FoundryClient(foundryConfig, logger);

const dsa5Creator = new DSA5CharacterCreator({
  foundryClient,
  logger,
});

// Test the tool
try {
  console.log('Connecting to Foundry MCP...');
  await foundryClient.connect();

  console.log('Calling list-dsa5-archetypes...');
  const result = await dsa5Creator.handleListArchetypes({});

  console.log('\n=== RESULT ===');
  console.log('Summary:', result.summary);
  console.log('Count:', result.count);
  console.log('\nArchetypes:');
  result.archetypes.forEach((arch, i) => {
    console.log(`${i + 1}. ${arch.name} (${arch.species}, ${arch.profession})`);
    console.log(`   Pack: ${arch.packLabel} | ID: ${arch.id}`);
  });

} catch (error) {
  console.error('Error:', error.message);
  console.error(error.stack);
} finally {
  await foundryClient.disconnect();
  process.exit(0);
}
