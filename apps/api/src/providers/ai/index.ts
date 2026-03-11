import { IAIProvider } from './IAIProvider';
import { MockAIProvider } from './mockAIProvider';
import { OpenAIProvider } from './openAIProvider';
import { config } from '../../config';

export function getAIProvider(): IAIProvider {
  if (config.aiProvider === 'openai' && config.openaiApiKey) {
    return new OpenAIProvider();
  }
  return new MockAIProvider();
}
