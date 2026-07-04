import fs from 'node:fs';
import OpenAI from 'openai';
const env = fs.readFileSync('.env.local','utf8');
const g = k => (env.match(new RegExp('^'+k+'=(.*)$','m'))||[])[1]?.trim();
const apiKey = g('NVIDIA_API_KEY');
const baseURL = g('NVIDIA_BASE_URL') || 'https://integrate.api.nvidia.com/v1';
const model = g('NVIDIA_MODEL') || 'meta/llama-3.3-70b-instruct';
console.log('model=', model, 'baseURL=', baseURL);
const client = new OpenAI({ apiKey, baseURL });
try {
  const resp = await client.chat.completions.create({
    model,
    messages: [{role:'system',content:'You are a test.'},{role:'user',content:'Reply OK.'}],
    tools: [{type:'function',function:{name:'send_message',description:'x',parameters:{type:'object',properties:{leadId:{type:'string'},channel:{type:'string'},body:{type:'string'}},required:['leadId','channel','body']}}}],
    tool_choice: 'auto',
    max_tokens: 64,
  });
  console.log('SUCCESS:', JSON.stringify(resp.choices[0]?.message).slice(0,300));
} catch (e) {
  console.log('ERROR status=', e.status, 'name=', e.name);
  console.log('MESSAGE:', e.message?.slice(0,600));
  if (e.error) console.log('BODY:', JSON.stringify(e.error).slice(0,500));
}
