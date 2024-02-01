const fs = require('fs'); // Para operações síncronas
const fsp = fs.promises; // Para operações assíncronas baseadas em promessas
const axios = require('axios');
const https = require('https');
const fetch = require('node-fetch');
const Jimp = require('jimp');
const qrcode = require('qrcode-terminal');
const path = require('path');
const { Client, Buttons, List, MessageMedia, LocalAuth, Poll } = require('whatsapp-web.js');
const OpenAI = require('openai');
const { spawn } = require('child_process');
const { promisify } = require('util');
const writeFileAsync = promisify(fs.writeFile);

// Listener para pegar Erro no Server e Restartar
const exec = require('child_process').exec;
const EventEmitter = require('events');
class MyEmitter extends EventEmitter {}
const myEmitter = new MyEmitter();

myEmitter.on('errorEvent', (error) => {
    console.log('Erro detectado, tentando reiniciar o serviço:', error);

    // Executar o comando para reiniciar o processo
    exec('pm2 restart sendMessage', (err, stdout, stderr) => {
        if (err) {
            console.error('Erro ao tentar reiniciar o serviço:', err);
            return;
        }
        console.log('Saída do comando de reinicialização:', stdout);
    });
});

let restartAPI = false;
// Fim do Listener do Erro do Server

const DATABASE_FILE = "typesessaodb.json"
const sessao = "typeListener";
const init_delay = 60000; // Exponential Backoff delay
const db_length = 600; // Tamanho do banco de dados

const delay = ms => new Promise(res => setTimeout(res, ms));

console.log("Bem-vindo ao TypeZap IA 1.0 - A Integração mais completa Typebot + Whatsapp + OpenAI e ElevenLabs");
console.log(`Nome da sessão: ${sessao}`);

// Configurações para o primeiro cliente (Windows)
/*const client = new Client({
    authStrategy: new LocalAuth({ clientId: sessao }),
    puppeteer: {
      executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    }
  });*/
  
  //Kit com os comandos otimizados para nuvem Ubuntu Linux (créditos Pedrinho da Nasa Comunidade ZDG)
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: sessao }),
    puppeteer: {
      headless: true,
      //CAMINHO DO CHROME PARA WINDOWS (REMOVER O COMENTÁRIO ABAIXO)
      //executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      //===================================================================================
      // CAMINHO DO CHROME PARA MAC (REMOVER O COMENTÁRIO ABAIXO)
      //executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      //===================================================================================
      // CAMINHO DO CHROME PARA LINUX (REMOVER O COMENTÁRIO ABAIXO)
       executablePath: '/usr/bin/google-chrome-stable',
      //===================================================================================
      args: [
        '--no-sandbox', //Necessário para sistemas Linux
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // <- Este não funciona no Windows, apague caso suba numa máquina Windows
        '--disable-gpu'
      ]
    }
  });
  
// entao habilitamos o usuario a acessar o serviço de leitura do qr code
client.on('qr', qr => {
  qrcode.generate(qr, {small: true});
});

// apos isso ele diz que foi tudo certin
client.on('ready', () => {
  console.log('Listener Typebot e Wpp pronto e conectado.');
});

client.initialize();

//Mecanismo para criar pasta

function createFolderIfNotExists(folderPath) {
  if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
      console.log(`Pasta criada: ${folderPath}`);
  } else {
      console.log(`Pasta já existe: ${folderPath}`);
  }
}

// Caminhos das pastas
const audioBrutoPath = path.join(__dirname, 'audiobruto');
const audioLiquidoPath = path.join(__dirname, 'audioliquido');
const audioSintetizadoPath = path.join(__dirname, 'audiosintetizado');
const imagemPath = path.join(__dirname, 'imagemliquida');

// Criar as pastas
createFolderIfNotExists(audioBrutoPath);
createFolderIfNotExists(audioLiquidoPath);
createFolderIfNotExists(audioSintetizadoPath);
createFolderIfNotExists(imagemPath);

//Fim do mecanismo para criar pasta

// Agora você pode usar 'openai' aqui, contanto que a inicialização tenha sido bem-sucedida

//Mecanismo para criação de audio

//Fim do mecanismo para criação de audio

// Rodando imagem IA

async function runDallE(promptText, imagePath, imageName) {
  try {
      const genimage = await openai.images.generate({
          model: "dall-e-3",
          prompt: promptText,
          n: 1,
          size: "1024x1024",
      });
      const imageUrl = genimage.data[0].url;
      const filePath = path.join(imagePath, `${imageName}.png`);
      await saveImage(imageUrl, filePath);
      return filePath; // Retorna o caminho do arquivo da imagem salva
  } catch (error) {
      console.error('Erro ao gerar ou salvar a imagem:', error);
      throw error;
  }
}

async function saveImage(imageUrl, filePath) {
  // Fazer uma requisição HTTP GET para a imagem
  https.get(imageUrl, (response) => {
    // Inicializar um stream de escrita no arquivo
    const fileStream = fs.createWriteStream(filePath);

    // Escrever o conteúdo da imagem no arquivo
    response.pipe(fileStream);

    // Registrar o evento de finalização da escrita
    fileStream.on('finish', () => {
      console.log(`A imagem foi salva em ${filePath}`);
    });
  });
}

//Mecanismo para reconhecimento de audio e imagem

async function runAudio(arquivo) {  
  const transcript = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file: fs.createReadStream(arquivo),
  });  
  return transcript.text;  
}

async function sintetizarFalaOpenAI(texto, nomeArquivo, voice) {
  try {
    const requestData = {
      model: 'tts-1',
      input: texto,
      voice: voice,
    };

    // Configura os cabeçalhos da solicitação
    const headers = {
      Authorization: `Bearer ${await readURL(0).openaikey}`,
      'Content-Type': 'application/json',
    };

    // Realiza a solicitação
    const response = await axios.post('https://api.openai.com/v1/audio/speech', requestData, { headers, responseType: 'stream' });

    const fileStream = response.data;
    const writeStream = fs.createWriteStream(`audiosintetizado/${nomeArquivo}.ogg`);

    fileStream.pipe(writeStream);

    await new Promise((resolve) => {
      writeStream.on('finish', () => {
        console.log(`Arquivo "${nomeArquivo}.ogg" baixado com sucesso.`);
        resolve();
      });
    });
  } catch (error) {
    console.error('Erro ao fazer a solicitação:', error);
  }
}

// ElevenLabs

// Configurações de voz previamente definidas
const voice_SETTINGS = {  
  similarity_boost: 0.75, 
  stability: 0.5,       
  style: 0,           
  use_speaker_boost: true
};

// Função ajustada para fazer a requisição via fetch
async function textToSpeech(voiceId, text, voiceSettings, elevenlabsKey) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  const headers = {
    'Content-Type': 'application/json',
    'xi-api-key': elevenlabsKey
  };
  const data = {
    text,
    model_id: "eleven_multilingual_v2",
    voice_settings: voiceSettings
  };

  return fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(data)
  });
}

// Função para salvar o arquivo de áudio
function saveAudioFile(response, outputPath) {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(outputPath);
    response.body.pipe(fileStream);
    response.body.on('error', (error) => {
      console.error('Erro ao salvar o arquivo de áudio:', error);
      reject(error);
    });
    fileStream.on('finish', () => {
      console.log(`Arquivo de áudio salvo: ${outputPath}`);
      resolve();
    });
  });
}

// Função para tratar erro
function handleError(err) {
  console.error('Erro na API:', err);
}

// Ajuste da função sintetizarFalaEleven
async function sintetizarFalaEleven(texto, nomeArquivo, voiceId) {
  try {
    // Extrai a chave da API ElevenLabs
    const elevenlabsKey = readURL(0).elevenlabskey;

    // Define o caminho do arquivo de saída no diretório audiosintetizado
    const outputPath = path.join('audiosintetizado', `${nomeArquivo}.ogg`);

    // Cria o diretório se não existir
    if (!fs.existsSync('audiosintetizado')) {
      fs.mkdirSync('audiosintetizado', { recursive: true });
    }

    // Realiza a solicitação para conversão de texto em fala
    const response = await textToSpeech(voiceId, texto, voice_SETTINGS, elevenlabsKey);
    
    if (!response.ok) {
      throw new Error(`Falha na API com status: ${response.status}`);
    }

    // Salva o arquivo de áudio
    await saveAudioFile(response, outputPath);
  } catch (error) {
    handleError(error);
    throw error; // Opcionalmente, re-lance o erro para tratamento adicional
  }
}

// ElevenLabs

async function converterArquivoOGGparaMP3(caminhoArquivoEntrada, nomeArquivoSaida) {
return new Promise((resolve, reject) => {
  const ffmpeg = spawn('ffmpeg', ['-y', '-i', caminhoArquivoEntrada, '-loglevel', '0', '-nostats', nomeArquivoSaida]);

  ffmpeg.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });

  ffmpeg.on('close', (code) => {
    if (code !== 0) {
      reject(`Erro ao executar o comando, código de saída: ${code}`);
    } else {
      resolve(`Arquivo convertido com sucesso para o formato MP3: ${nomeArquivoSaida}`);
    }
  });
});
}

async function runImage(promptText, base64Image) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4-vision-preview',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: promptText },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`,
            },
          },
        ],
      },
    ],
  });

  return response.choices[0].message.content;
}

async function getImageContent(filePath) {
  try {
      const imageData = fs.readFileSync(filePath);
      return imageData;
  } catch (error) {
      console.error('Erro ao ler a imagem:', error);
      throw error;
  }
}

function encodeImage(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  return Buffer.from(imageBuffer).toString('base64');
}

async function processMessageIA(msg) {

if (msg.hasMedia) {
  const attachmentData = await msg.downloadMedia();
  if(readNextAudio(msg.from) === false && attachmentData.mimetype === 'audio/ogg; codecs=opus'){
    return;
  }
  if (readNextAudio(msg.from) === true && attachmentData.mimetype !== 'audio/ogg; codecs=opus' && !attachmentData.mimetype.startsWith('image/')){
    return "Mídia não detectada.";
  }
  if (readNextAudio(msg.from) === true && attachmentData.mimetype === 'audio/ogg; codecs=opus'){
    const audioFilePath = `./audiobruto/${msg.from.split('@c.us')[0]}.ogg`;

    if (fs.existsSync(audioFilePath)) {
      fs.unlinkSync(audioFilePath);
    }

    await writeFileAsync(audioFilePath, Buffer.from(attachmentData.data, 'base64'));

    while (true) {
      try {
        if (fs.existsSync(audioFilePath)) {
          await converterArquivoOGGparaMP3(audioFilePath, `./audioliquido/${msg.from.split('@c.us')[0]}.mp3`);
          fs.unlinkSync(audioFilePath);
          return await brokerMaster(runAudio, `./audioliquido/${msg.from.split('@c.us')[0]}.mp3`);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        console.error(err);
        break;
      }
    }
  }
  if (readNextImage(msg.from) === true && attachmentData.mimetype.startsWith('image/')) {
    const imageFilePath = `./imagemliquida/${msg.from.split('@c.us')[0]}.jpg`;

    // Verifica se o arquivo já existe e, se sim, o remove
    if (fs.existsSync(imageFilePath)) {
      fs.unlinkSync(imageFilePath);
    }

    // Salva a imagem recebida em um arquivo
    await writeFileAsync(imageFilePath, Buffer.from(attachmentData.data, 'base64'));

    // Loop para garantir que a imagem foi salva antes de prosseguir
    while (true) {
      try {
        if (fs.existsSync(imageFilePath)) {
          // Codifica a imagem em base64
          const base64Image = encodeImage(imageFilePath);          
          // Obtém a resposta do Vision e retorna
          return `Imagem enviada pelo usuário: ${await runImage(await readPrompt(msg.from), base64Image)}`;
        }

        // Aguarda um pouco antes de verificar novamente
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        console.error(err);
        break;
      }
    }
  }  
  if (readNextImage(msg.from) === false && attachmentData.mimetype.startsWith('image/')){
    return;
  }
  } 
  if (!msg.hasMedia) {
  return msg.body;
  }
}

function brokerMaster(requestFunction, ...args) {
  const backoffDelay = 1000;
  const maxRetries = 10;

  return new Promise((resolve, reject) => {
    const makeRequest = (retryCount) => {
      requestFunction(...args)
        .then((response) => {
          resolve(response);
        })
        .catch((error) => {
          if (retryCount === maxRetries) {
            reject(error);
            return;
          }

          const delay = backoffDelay * Math.pow(2, retryCount);
          console.log(`Tentativa ${retryCount + 1} falhou. Tentando novamente em ${delay}ms...`);
          console.log(error);
          setTimeout(() => makeRequest(retryCount + 1), delay);
        });
    };

    makeRequest(0);
  });
}

//Mecanismo para produção de audio

//Rotinas da gestão de dados

function readJSONFile(nomeArquivo) {
  if (fs.existsSync(nomeArquivo)) {
    const dados = fs.readFileSync(nomeArquivo);
    return JSON.parse(dados);
  } else {
    return [];
  }
}

function writeJSONFile(nomeArquivo, dados) {
  const dadosJSON = JSON.stringify(dados, null, 2);
  fs.writeFileSync(nomeArquivo, dadosJSON);
}

// Dados do sistema

const DATABASE_FILE_SYSTEM = 'typeSystemDB.json';

function addObjectSystem(url_chat, openaikey, elevenlabskey) {
  const dadosAtuais = readJSONFile(DATABASE_FILE_SYSTEM);

  // Verificar a unicidade do url_chat
  const existeurlchat = dadosAtuais.some(objeto => objeto.url_chat === url_chat);
  if (existeurlchat) {
    throw new Error('O URL Chat já existe no banco de dados.');
  }

  const objeto = {url_chat, openaikey, elevenlabskey};  

  dadosAtuais.push(objeto);
  writeJSONFile(DATABASE_FILE_SYSTEM, dadosAtuais);
}

function readURL(indice) {
  const dadosAtuais = readJSONFile(DATABASE_FILE_SYSTEM);

  // Verifica se o índice é válido
  if (indice < 0 || indice >= dadosAtuais.length) {
      console.error('Índice inválido.');
      return null;
  }

  // Retorna a URL e as chaves correspondentes ao índice fornecido
  const objeto = dadosAtuais[indice];
  return {
      url_chat: objeto.url_chat,
      openaikey: objeto.openaikey,
      elevenlabskey: objeto.elevenlabskey
  };
}

function updateObjectSystem(url_chat, openaikey, elevenlabskey) {
  const dadosAtuais = readJSONFile(DATABASE_FILE_SYSTEM);
  const objeto = dadosAtuais.find(obj => obj.url_chat === url_chat);

  if (!objeto) {
      throw new Error('URL Chat não encontrado.');
  }

  objeto.openaikey = openaikey;
  objeto.elevenlabskey = elevenlabskey;

  writeJSONFile(DATABASE_FILE_SYSTEM, dadosAtuais);
}

function deleteObjectSystem(url_chat) {
  const dadosAtuais = readJSONFile(DATABASE_FILE_SYSTEM);
  const novosDados = dadosAtuais.filter(obj => obj.url_chat !== url_chat);
  writeJSONFile(DATABASE_FILE_SYSTEM, novosDados);
}

function existsDBSystem(url_chat) {
  const dadosAtuais = readJSONFile(DATABASE_FILE_SYSTEM);
  return dadosAtuais.some(obj => obj.url_chat !== url_chat);
}

function existsTheDBSystem() {
  // Verifica se o arquivo DATABASE_FILE_SYSTEM existe
  if (!fs.existsSync(DATABASE_FILE_SYSTEM)) {
    return false; // Retorna false se o arquivo não existir
  }

  const dadosAtuais = readJSONFile(DATABASE_FILE_SYSTEM);

  // Verifica se o arquivo está vazio
  if (dadosAtuais.length === 0) {
    return false; // Retorna false se o arquivo estiver vazio
  }
  
  return true;
}

// Fim dos dados do sistema

//Gestão de dados do controle das sessões

function addObject(numeroId, sessionid, numero, id, interact, fluxo, optout, flow, nextAudio, nextImage, prompt, maxObjects) {
  const dadosAtuais = readJSONFile(DATABASE_FILE);

  // Verificar a unicidade do numeroId
  const existeNumeroId = dadosAtuais.some(objeto => objeto.numeroId === numeroId);
  if (existeNumeroId) {
    throw new Error('O numeroId já existe no banco de dados.');
  }

  const objeto = { numeroId, sessionid, numero, id, interact, fluxo, optout, flow, nextAudio, nextImage, prompt};

  if (dadosAtuais.length >= maxObjects) {
    // Excluir o objeto mais antigo
    dadosAtuais.shift();
  }

  dadosAtuais.push(objeto);
  writeJSONFile(DATABASE_FILE, dadosAtuais);
}

function readMap(numeroId) {
  const dadosAtuais = readJSONFile(DATABASE_FILE);
  const objeto = dadosAtuais.find(obj => obj.numeroId === numeroId);
  return objeto;
}

function deleteObject(numeroId) {
  const dadosAtuais = readJSONFile(DATABASE_FILE);
  const novosDados = dadosAtuais.filter(obj => obj.numeroId !== numeroId);
  writeJSONFile(DATABASE_FILE, novosDados);
}

function existsDB(numeroId) {
  const dadosAtuais = readJSONFile(DATABASE_FILE);
  return dadosAtuais.some(obj => obj.numeroId === numeroId);
}

function updatePrompt(numeroId, prompt) {
  const dadosAtuais = readJSONFile(DATABASE_FILE);
  const objeto = dadosAtuais.find(obj => obj.numeroId === numeroId);
  if (objeto) {
    objeto.prompt = prompt;
    writeJSONFile(DATABASE_FILE, dadosAtuais);
  }
}  

function readPrompt(numeroId) {
  const objeto = readMap(numeroId);
  return objeto ? objeto.prompt : undefined;
}

function updateNextAudio(numeroId, nextAudio) {
  const dadosAtuais = readJSONFile(DATABASE_FILE);
  const objeto = dadosAtuais.find(obj => obj.numeroId === numeroId);
  if (objeto) {
    objeto.nextAudio = nextAudio;
    writeJSONFile(DATABASE_FILE, dadosAtuais);
  }
}  

function readNextAudio(numeroId) {
  const objeto = readMap(numeroId);
  return objeto ? objeto.nextAudio : undefined;
}

function updateNextImage(numeroId, nextImage) {
  const dadosAtuais = readJSONFile(DATABASE_FILE);
  const objeto = dadosAtuais.find(obj => obj.numeroId === numeroId);
  if (objeto) {
    objeto.nextImage = nextImage;
    writeJSONFile(DATABASE_FILE, dadosAtuais);
  }
}  

function readNextImage(numeroId) {
  const objeto = readMap(numeroId);
  return objeto ? objeto.nextImage : undefined;
}

function updateSessionId(numeroId, sessionid) {
  const dadosAtuais = readJSONFile(DATABASE_FILE);
  const objeto = dadosAtuais.find(obj => obj.numeroId === numeroId);
  if (objeto) {
    objeto.sessionid = sessionid;
    writeJSONFile(DATABASE_FILE, dadosAtuais);
  }
}

function readSessionId(numeroId) {
  const objeto = readMap(numeroId);
  return objeto ? objeto.sessionid : undefined;
}

function updateId(numeroId, id) {
  const dadosAtuais = readJSONFile(DATABASE_FILE);
  const objeto = dadosAtuais.find(obj => obj.numeroId === numeroId);
  if (objeto) {
    objeto.id = id;
    writeJSONFile(DATABASE_FILE, dadosAtuais);
  }
}  

function readId(numeroId) {
  const objeto = readMap(numeroId);
  return objeto ? objeto.id : undefined;
}

function updateInteract(numeroId, interact) {
  const dadosAtuais = readJSONFile(DATABASE_FILE);
  const objeto = dadosAtuais.find(obj => obj.numeroId === numeroId);
  if (objeto) {
    objeto.interact = interact;
    writeJSONFile(DATABASE_FILE, dadosAtuais);
  }
}

function readInteract(numeroId) {
  const objeto = readMap(numeroId);
  return objeto ? objeto.interact : undefined;
}

function updateFluxo(numeroId, fluxo) {
  const dadosAtuais = readJSONFile(DATABASE_FILE);
  const objeto = dadosAtuais.find(obj => obj.numeroId === numeroId);
  if (objeto) {
    objeto.fluxo = fluxo;
    writeJSONFile(DATABASE_FILE, dadosAtuais);
  }
}

function readFluxo(numeroId) {
    if (!existsDB(numeroId)) {     
      return undefined;
  }
  const objeto = readMap(numeroId);
  return objeto ? objeto.fluxo : undefined;
}

function updateOptout(numeroId, optout) {
  const dadosAtuais = readJSONFile(DATABASE_FILE);
  const objeto = dadosAtuais.find(obj => obj.numeroId === numeroId);
  if (objeto) {
    objeto.optout = optout;
    writeJSONFile(DATABASE_FILE, dadosAtuais);
  }
}

function readOptout(numeroId) {
    if (!existsDB(numeroId)) {     
      return undefined;
  }
  const objeto = readMap(numeroId);
  return objeto ? objeto.optout : undefined;
}

function updateFlow(numeroId, flow) {
  const dadosAtuais = readJSONFile(DATABASE_FILE);
  const objeto = dadosAtuais.find(obj => obj.numeroId === numeroId);
  if (objeto) {
    objeto.flow = flow;
    writeJSONFile(DATABASE_FILE, dadosAtuais);
  }
}

function readFlow(numeroId) {
    if (!existsDB(numeroId)) {     
      return undefined;
  }
  const objeto = readMap(numeroId);
  return objeto ? objeto.flow : undefined;
}

//Fim das rotinas do banco de dados de gestão das sessões

const DATABASE_FILE_TYPE = 'typebotDB.json';

function initializeDB() {
  // Verifica se o arquivo do banco de dados já existe
  if (!fs.existsSync(DATABASE_FILE_TYPE)) {
      // Se não existir, inicializa com os dados de typebotConfigs
      const typebotConfigs = {
          typebot1: {
              url_registro: 'https://seutypebot/api/v1/typebots/funil-base-f8uqcdj/startChat',      
              gatilho: "gatilho do seu fluxo",
              name: "nomedofluxo"
          }
      };

      const db = {};
      Object.values(typebotConfigs).forEach(config => {
          db[config.name] = config;
      });

      writeJSONFile(DATABASE_FILE_TYPE, db);
  } else {
      // Se já existir, mantém os dados existentes
      console.log('Banco de dados principal já existe e não será sobrescrito.');
  }
}

function addToDB(config) {
    const db = readJSONFile(DATABASE_FILE_TYPE);
    db[config.name] = config;
    writeJSONFile(DATABASE_FILE_TYPE, db);
}

function removeFromDB(name) {
    const db = readJSONFile(DATABASE_FILE_TYPE);
    delete db[name];
    writeJSONFile(DATABASE_FILE_TYPE, db);
}

function updateDB(name, newConfig) {
    const db = readJSONFile(DATABASE_FILE_TYPE);
    if (db[name]) {
        db[name] = newConfig;
        writeJSONFile(DATABASE_FILE_TYPE, db);
    }
}

function readFromDB(name) {
    const db = readJSONFile(DATABASE_FILE_TYPE);
    return db[name];
}

function listAllFromDB() {
    return readJSONFile(DATABASE_FILE_TYPE);
}

// Inicio das rotinas do banco de dados para guardar multiplos fluxos de Typebot

const DATABASE_FILE_SELF = 'typeconfigsdb.json';

function salvarNoJSONSelf(nomeArquivo, numeroId) {
  const dadosAtuais = readJSONFile(DATABASE_FILE_SELF);

  // Encontrar o objeto com o número de ID correspondente
  const objetoEncontrado = dadosAtuais.find(objeto => objeto.numeroId === numeroId);

  if (!objetoEncontrado) {
    throw new Error('Não foi encontrado um objeto com o numeroId fornecido.');
  }

  // Verificar se o nome do arquivo foi fornecido
  if (!nomeArquivo) {
    throw new Error('É necessário fornecer um nome de arquivo.');
  }

  // Adicionar a extensão .json ao nome do arquivo, se necessário
  if (!nomeArquivo.endsWith('.json')) {
    nomeArquivo += '.json';
  }

  let objetosExistente = [];
  if (fs.existsSync(nomeArquivo)) {
    // Se o arquivo já existe, ler os objetos existentes
    const arquivoExistente = fs.readFileSync(nomeArquivo, 'utf-8');
    objetosExistente = JSON.parse(arquivoExistente);
  }

  // Adicionar o objeto encontrado ao array de objetos existentes
  objetosExistente.push(objetoEncontrado);

  // Salvar os objetos no arquivo JSON
  fs.writeFileSync(nomeArquivo, JSON.stringify(objetosExistente, null, 2));
}

function addObjectSelf(numeroId, flowState, id, interact, urlregistro, gatilho, name) {
  const dadosAtuais = readJSONFile(DATABASE_FILE_SELF);

  // Verificar a unicidade do numeroId
  const existeNumeroId = dadosAtuais.some(objeto => objeto.numeroId === numeroId);
  if (existeNumeroId) {
    throw new Error('O numeroId já existe no banco de dados - Central de Controle.');
  }

  const objeto = { numeroId, flowState, id, interact, urlregistro, gatilho, name};

  dadosAtuais.push(objeto);
  writeJSONFile(DATABASE_FILE_SELF, dadosAtuais);
}

function deleteObjectSelf(numeroId) {
const dadosAtuais = readJSONFile(DATABASE_FILE_SELF);
const novosDados = dadosAtuais.filter(obj => obj.numeroId !== numeroId);
writeJSONFile(DATABASE_FILE_SELF, novosDados);
}

function existsDBSelf(numeroId) {
const dadosAtuais = readJSONFile(DATABASE_FILE_SELF);
return dadosAtuais.some(obj => obj.numeroId === numeroId);
}

function updateFlowSelf(numeroId, flowState) {
  const dadosAtuais = readJSONFile(DATABASE_FILE_SELF);
  const objeto = dadosAtuais.find(obj => obj.numeroId === numeroId);
  if (objeto) {
    objeto.flowState = flowState;
    writeJSONFile(DATABASE_FILE_SELF, dadosAtuais);
  }
}

function readFlowSelf(numeroId) {
  const objeto = readMapSelf(numeroId);
  return objeto ? objeto.flowState : undefined;
}

function updateIdSelf(numeroId, id) {
  const dadosAtuais = readJSONFile(DATABASE_FILE_SELF);
  const objeto = dadosAtuais.find(obj => obj.numeroId === numeroId);
  if (objeto) {
    objeto.id = id;
    writeJSONFile(DATABASE_FILE_SELF, dadosAtuais);
  }
}

function readIdSelf(numeroId) {
  const objeto = readMapSelf(numeroId);
  return objeto ? objeto.id : undefined;
}

function updateInteractSelf(numeroId, interact) {
  const dadosAtuais = readJSONFile(DATABASE_FILE_SELF);
  const objeto = dadosAtuais.find(obj => obj.numeroId === numeroId);
  if (objeto) {
    objeto.interact = interact;
    writeJSONFile(DATABASE_FILE_SELF, dadosAtuais);
  }
}

function readInteractSelf(numeroId) {
  const objeto = readMapSelf(numeroId);
  return objeto ? objeto.interact : undefined;
}

function updateURLRegistro(numeroId, urlregistro) {
  const dadosAtuais = readJSONFile(DATABASE_FILE_SELF);
  const objeto = dadosAtuais.find(obj => obj.numeroId === numeroId);
  if (objeto) {
    objeto.urlregistro = urlregistro;
    writeJSONFile(DATABASE_FILE_SELF, dadosAtuais);
  }
}

  function readURLRegistro(numeroId) {
  const objeto = readMapSelf(numeroId);
  return objeto ? objeto.urlregistro : undefined;
}

function updateGatilho(numeroId, gatilho) {
  const dadosAtuais = readJSONFile(DATABASE_FILE_SELF);
  const objeto = dadosAtuais.find(obj => obj.numeroId === numeroId);
  if (objeto) {
    objeto.gatilho = gatilho;
    writeJSONFile(DATABASE_FILE_SELF, dadosAtuais);
  }
}

function readGatilho(numeroId) {
  const objeto = readMapSelf(numeroId);
  return objeto ? objeto.gatilho : undefined;
}

function updateName(numeroId, name) {
  const dadosAtuais = readJSONFile(DATABASE_FILE_SELF);
  const objeto = dadosAtuais.find(obj => obj.numeroId === numeroId);
  if (objeto) {
    objeto.name = name;
    writeJSONFile(DATABASE_FILE_SELF, dadosAtuais);
  }
}

function readName(numeroId) {
  const objeto = readMapSelf(numeroId);
  return objeto ? objeto.name : undefined;
}

function readMapSelf(numeroId) {
  const dadosAtuais = readJSONFile(DATABASE_FILE_SELF);
  const objeto = dadosAtuais.find(obj => obj.numeroId === numeroId);
  return objeto;
}

// Fim das rotinas do banco de dados para guardar multiplos fluxos de Typebot

// Inicio das rotinas de cadastro de respostas rápidas

const DATABASE_FILE_TYPEBOT_V2 = 'typebotDBV2.json';

function initializeDBTypebotV2() {
  // Verifica se o arquivo do banco de dados já existe
  if (!fs.existsSync(DATABASE_FILE_TYPEBOT_V2)) {
      // Se não existir, inicializa com um objeto vazio
      const db = {};
      writeJSONFileTypebotV2(DATABASE_FILE_TYPEBOT_V2, db);
  } else {
      // Se já existir, mantém os dados existentes
      console.log('Banco de dados V2 já existe e não será sobrescrito.');
  }
}

function addToDBTypebotV2(name, config) {
    const db = readJSONFileTypebotV2(DATABASE_FILE_TYPEBOT_V2);
    db[name] = config;
    writeJSONFileTypebotV2(DATABASE_FILE_TYPEBOT_V2, db);
}

function removeFromDBTypebotV2(name) {
    const db = readJSONFileTypebotV2(DATABASE_FILE_TYPEBOT_V2);
    delete db[name];
    writeJSONFileTypebotV2(DATABASE_FILE_TYPEBOT_V2, db);
}

function updateDBTypebotV2(name, newConfig) {
    const db = readJSONFileTypebotV2(DATABASE_FILE_TYPEBOT_V2);
    if (db[name]) {
        db[name] = newConfig;
        writeJSONFileTypebotV2(DATABASE_FILE_TYPEBOT_V2, db);
    }
}

function readFromDBTypebotV2(name) {
    const db = readJSONFileTypebotV2(DATABASE_FILE_TYPEBOT_V2);
    return db[name];
}

function listAllFromDBTypebotV2() {
    return readJSONFileTypebotV2(DATABASE_FILE_TYPEBOT_V2);
}

function readJSONFileTypebotV2(filename) {
    try {
        return JSON.parse(fs.readFileSync(filename, 'utf8'));
    } catch (error) {
        return {};
    }
}

function writeJSONFileTypebotV2(filename, data) {
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
}

let reinit = false;

async function createSessionJohnnyV2(data, datafrom, url_registro, fluxo) {
  
  const reqData = JSON.stringify({
    isStreamEnabled: true,
    message: "string", // Substitua se necessário
    resultId: "string", // Substitua se necessário
    isOnlyRegistering: false,
    prefilledVariables: {
      number: datafrom.split('@')[0],
      name: data.notifyName
    },
  });

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: url_registro,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    data: reqData
  };

  try {   

    const response = await axios.request(config);

    const messages = response.data.messages;

    if (!existsDB(datafrom) && reinit === false) {
      addObject(datafrom, response.data.sessionId, datafrom.replace(/\D/g, ''), JSON.stringify(data.id.id), 'typing', fluxo, false, "active", false, false, null, db_length);
    }
    
    if(datafrom.endsWith('@c.us')){
    for (const message of messages){
      if (message.type === 'text') {
        let formattedText = '';
        for (const richText of message.content.richText) {
          for (const element of richText.children) {
            let text = '';
    
            if (element.text) {
              text = element.text;
            } else if (element.type === 'inline-variable') {              
              text = element.children[0].children[0].text;
            }
    
            if (element.bold) {
              text = `*${text}*`;
            }
            if (element.italic) {
              text = `_${text}_`;
            }
            if (element.underline) {
              text = `~${text}~`;
            }
    
            formattedText += text;
          }
          formattedText += '\n';
        }
    
        formattedText = formattedText.replace(/\n$/, '');
        if (formattedText.startsWith('!wait')) {
          await waitWithDelay(formattedText);
        }
        if (formattedText.startsWith('!fim')) {
          if (existsDB(datafrom)) {
            updateFlow(datafrom, "inactive");
          }
        }
        if (formattedText.startsWith('!optout')) {          
          if (existsDB(datafrom)) {
            updateOptout(datafrom, true);
            removeFromDBTypebotV4(datafrom);
          }
        }
        if (formattedText.startsWith('!reiniciar')) {
          if (existsDB(datafrom)) {
            deleteObject(datafrom);
            reinit = true;
          }
        }
        if (formattedText.startsWith('!entenderaudio')) {          
          if (existsDB(datafrom)) {
            updateNextAudio(datafrom, true);
          }
        }
        if (formattedText.startsWith('!entenderimagem')) {          
          if (existsDB(datafrom)) {
            updateNextImage(datafrom, true);
            updatePrompt(datafrom, formattedText.split(' ').slice(1).join(' '));
          }
        }
        if (formattedText.startsWith('!audioopenai')) {          
          if (existsDB(datafrom)) {
      
              try {
                  // Sintetizar a fala
                  await brokerMaster(sintetizarFalaOpenAI, formattedText.split(' ').slice(2).join(' '), datafrom.split('@c.us')[0], formattedText.split(' ')[1]);
      
                  // Caminho do arquivo de áudio gerado
                  const mediaPath = `audiosintetizado/${datafrom.split('@c.us')[0]}.ogg`;
      
                  // Aqui você insere a lógica para tratar a mídia, se necessário
                  const media = await tratarMidia(mediaPath);
      
                  let retries = 0;
                  const maxRetries = 15; // Máximo de tentativas
                  let delay = init_delay; // Tempo inicial de espera em milissegundos
      
                  const sendRequest = async () => {
                      const response = await fetch('http://localhost:3000/sendMessage', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                              destinatario: datafrom,
                              media: media,
                              tipo: "audio",                    
                              msg: data
                          })
                      });
      
                      if (!response.ok) {
                          throw new Error(`Request failed with status ${response.status}`);
                      }
      
                      return await response.json();
                  };
      
                  while (retries < maxRetries) {
                      try {
                          await sendRequest();
                          restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                          break; // Sai do loop se a requisição for bem-sucedida
                      } catch (error) {
                          retries++;
                          console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                          if (!restartAPI) {
                              myEmitter.emit('errorEvent', error);
                              restartAPI = true;
                          }
                          await new Promise(resolve => setTimeout(resolve, delay));
                          delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
                      }
                  }
      
                  if (retries === maxRetries) {
                      console.error('Erro: Número máximo de tentativas de envio atingido.');
                  }
      
              } catch (error) {
                  console.error('Erro ao sintetizar fala:', error);
              }
          }
        }
        if (formattedText.startsWith('!audioeleven')) {
          if (existsDB(datafrom)) {
      
              try {
                  // Extrai o nome da voz e o texto a ser sintetizado do comando
                  // Sintetizar a fala usando ElevenLabs
                  await brokerMaster(sintetizarFalaEleven, formattedText.split(' ').slice(2).join(' '), datafrom.split('@c.us')[0], formattedText.split(' ')[1]);
      
                  // Caminho do arquivo de áudio gerado
                  const mediaPath = `audiosintetizado/${datafrom.split('@c.us')[0]}.ogg`;
      
                  // Aqui você insere a lógica para tratar a mídia, se necessário
                  const media = await tratarMidia(mediaPath);
      
                  let retries = 0;
                  const maxRetries = 15; // Máximo de tentativas
                  let delay = init_delay; // Tempo inicial de espera em milissegundos
      
                  const sendRequest = async () => {
                      const response = await fetch('http://localhost:3000/sendMessage', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                              destinatario: datafrom,
                              media: media,
                              tipo: "audio",                    
                              msg: ""
                          })
                      });
      
                      if (!response.ok) {
                          throw new Error(`Request failed with status ${response.status}`);
                      }
      
                      return await response.json();
                  };
      
                  while (retries < maxRetries) {
                      try {
                          await sendRequest();
                          restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                          break; // Sai do loop se a requisição for bem-sucedida
                      } catch (error) {
                          retries++;
                          console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                          if (!restartAPI) {
                              myEmitter.emit('errorEvent', error);
                              restartAPI = true;
                          }
                          await new Promise(resolve => setTimeout(resolve, delay));
                          delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
                      }
                  }
      
                  if (retries === maxRetries) {
                      console.error('Erro: Número máximo de tentativas de envio atingido.');
                  }
      
              } catch (error) {
                  console.error('Erro ao sintetizar fala com ElevenLabs:', error);
              }
          }
        }
        if (formattedText.startsWith('!imagemopenai')) {
          await runDallE(formattedText.split(' ').slice(1).join(' '), 'imagemliquida', datafrom.split('@c.us')[0])
              .then(async (filePath) => {
                while (true) {
                  try {
                      if (fs.existsSync(filePath)) {
                          await Jimp.read(filePath); // Tenta ler a imagem
                          break; // Se a imagem for lida sem erros, saia do loop
                      }
                  } catch (error) {
                      console.log("A imagem ainda está sendo renderizada...");
                  }
                  await new Promise(resolve => setTimeout(resolve, 1000)); // Aguarda 1 segundo
              }
      
                  let retries = 0;
                  const maxRetries = 15; // Máximo de tentativas
                  let delay = init_delay; // Tempo inicial de espera em milissegundos
      
                  const sendRequest = async () => {
                      const media = await tratarMidia(filePath);
                      const response = await fetch('http://localhost:3000/sendMessage', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                              destinatario: datafrom,
                              media: media,
                              tipo: "image",
                              msg: "" // Mensagem opcional
                          })
                      });
      
                      if (!response.ok) {
                          throw new Error(`Request failed with status ${response.status}`);
                      }
      
                      return await response.json();
                  };
      
                  while (retries < maxRetries) {
                    try {
                        await sendRequest();
                        restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                        break; // Sai do loop se a requisição for bem-sucedida
                    } catch (error) {
                        retries++;
                        console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                        if (!restartAPI) {
                            myEmitter.emit('errorEvent', error);
                            restartAPI = true;
                        }
                        await new Promise(resolve => setTimeout(resolve, delay));
                        delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
                    }
                }
      
                  if (retries === maxRetries) {
                      console.error('Erro: Número máximo de tentativas de envio atingido.');
                  } else {
                      // Apagar a imagem após o envio bem-sucedido
                      fs.unlink(filePath, (err) => {
                          if (err) console.error('Erro ao apagar a imagem:', err);
                          else console.log(`Imagem ${filePath} apagada com sucesso.`);
                      });
                  }
              })
              .catch((error) => console.error("Erro durante a geração da imagem:", error));
        }      
        if (!(formattedText.startsWith('!wait')) && !(formattedText.startsWith('!fim')) && !(formattedText.startsWith('!optout')) && !(formattedText.startsWith('!reiniciar')) && !(formattedText.startsWith('!entenderaudio')) && !(formattedText.startsWith('!entenderimagem')) && !(formattedText.startsWith('!audioopenai')) && !(formattedText.startsWith('!audioeleven'))  && !(formattedText.startsWith('!imagemopenai'))) {
          let retries = 0;
          const maxRetries = 15; // Máximo de tentativas
          let delay = init_delay; // Tempo inicial de espera em milissegundos
          
      
          const sendRequest = async () => {              
              const response = await fetch('http://localhost:3000/sendMessage', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      destinatario: datafrom,
                      mensagem: formattedText,
                      tipo: "text",
                      msg: data
                  })
              });
      
              if (!response.ok) {
                  throw new Error(`Request failed with status ${response.status}`);
              }
      
              return await response.json();
          };
      
          while (retries < maxRetries) {
              try {
                  await sendRequest();
                  restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                  break; // Sai do loop se a requisição for bem-sucedida
              } catch (error) {
                  retries++;
                  console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                  if (!restartAPI) {
                      myEmitter.emit('errorEvent', error);
                      restartAPI = true;
                  }
                  await new Promise(resolve => setTimeout(resolve, delay));
                  delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
              }
          }
      
          if (retries === maxRetries) {
              console.error('Erro: Número máximo de tentativas de envio atingido.');
          }
      }      
      }
      if (message.type === 'image') {
        let retries = 0;
        const maxRetries = 15; // Máximo de tentativas
        let delay = init_delay; // Tempo inicial de espera em milissegundos
       
    
        const sendRequest = async () => {
            const media = await tratarMidia(message);
            const response = await fetch('http://localhost:3000/sendMessage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    destinatario: datafrom,
                    media: media,
                    tipo: "image",
                    msg: data
                })
            });
    
            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }
    
            return await response.json();
        };
    
        while (retries < maxRetries) {
            try {
                await sendRequest();
                restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                break; // Sai do loop se a requisição for bem-sucedida
            } catch (error) {
                retries++;
                console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                if (!restartAPI) {
                    myEmitter.emit('errorEvent', error);
                    restartAPI = true;
                }
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
            }
        }
    
        if (retries === maxRetries) {
            console.error('Erro: Número máximo de tentativas de envio atingido.');
        }
      }                          
      if (message.type === 'video') {
        let retries = 0;
        const maxRetries = 15; // Máximo de tentativas
        let delay = init_delay; // Tempo inicial de espera em milissegundos
        
    
        const sendRequest = async () => {
            const media = await tratarMidia(message);
            const response = await fetch('http://localhost:3000/sendMessage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    destinatario: datafrom,
                    media: media,
                    tipo: "video",
                    msg: data
                })
            });
    
            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }
    
            return await response.json();
        };
    
        while (retries < maxRetries) {
            try {
                await sendRequest();
                restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                break; // Sai do loop se a requisição for bem-sucedida
            } catch (error) {
                retries++;
                console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                if (!restartAPI) {
                    myEmitter.emit('errorEvent', error);
                    restartAPI = true;
                }
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
            }
        }
    
        if (retries === maxRetries) {
            console.error('Erro: Número máximo de tentativas de envio atingido.');
        }
      }                            
      if (message.type === 'audio') {
        let retries = 0;
        const maxRetries = 15; // Máximo de tentativas
        let delay = init_delay; // Tempo inicial de espera em milissegundos
        
    
        const sendRequest = async () => {
            const media = await tratarMidia(message);
            
            const response = await fetch('http://localhost:3000/sendMessage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    destinatario: datafrom,
                    media: media,
                    tipo: "audio",                    
                    msg: data
                })
            });
    
            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }
    
            return await response.json();
        };
    
        while (retries < maxRetries) {
            try {
                await sendRequest();
                restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                break; // Sai do loop se a requisição for bem-sucedida
            } catch (error) {
                retries++;
                console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                if (!restartAPI) {
                    myEmitter.emit('errorEvent', error);
                    restartAPI = true;
                }
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
            }
        }
    
        if (retries === maxRetries) {
            console.error('Erro: Número máximo de tentativas de envio atingido.');
        }
      } 
    }
    const input = response.data.input
    if (input) {
      if (input.type === 'choice input') {
        let formattedText = '';
        const items = input.items;
        let arrayoptions = [];
        for (const item of items) {
          formattedText += `▶️ ${item.content}\n`;
          arrayoptions.push(item.content);
        }
        //console.log(arrayoptions)
          // await msg.reply(new Poll('Winter or Summer?', [arrayoptions]));
          // formattedText = formattedText.replace(/\n$/, '');
          await client.sendMessage(datafrom, new Poll('*Escolha uma resposta:*', arrayoptions));
        }
    }
  }
  if (datafrom.endsWith('@g.us')) {
    for (const message of messages) {
        let messageObj = {};

        if (message.type === 'text') {
            let formattedText = '';
            for (const richText of message.content.richText) {
                for (const element of richText.children) {
                    let text = '';
          
                    if (element.text) {
                        text = element.text;
                    } else if (element.type === 'inline-variable') {              
                        text = element.children[0].children[0].text;
                    }
          
                    if (element.bold) {
                        text = `*${text}*`;
                    }
                    if (element.italic) {
                        text = `_${text}_`;
                    }
                    if (element.underline) {
                        text = `~${text}~`;
                    }
          
                    formattedText += text;
                }
                formattedText += '\n';
            }
            formattedText = formattedText.replace(/\n$/, '');
            messageObj = { type: 'text', content: formattedText };
        } else if (message.type === 'image') {
            messageObj = { type: 'image', content: message };
        } else if (message.type === 'video') {
            messageObj = { type: 'video', content: message };
        } else if (message.type === 'audio') {
            messageObj = { type: 'audio', content: message };
        }

        // Adiciona a mensagem formatada ou de mídia ao grupo no banco de dados V5
        addMessageToGroupInV5(datafrom, messageObj);
        processGroupMessages(datafrom, isFirstRun = true);
    }
  }    
    if(existsDB(datafrom)){
      updateSessionId(datafrom, response.data.sessionId);
      updateId(datafrom, JSON.stringify(data.id.id));
      updateInteract(datafrom, 'done');
      updateFlow(datafrom, "active");
      updateName(datafrom, fluxo);
    }
    if(reinit === true){
      reinit = false;
    }    
  } catch (error) {
    console.log(error);
  }
}

// Fim das rotinas de cadastro das respostas rápidas

// Inicio das rotinas de disparo do remarketing

const DATABASE_FILE_TYPEBOT_V3 = 'typebotDBV3.json';

function initializeDBTypebotV3() {
  // Verifica se o arquivo do banco de dados já existe
  if (!fs.existsSync(DATABASE_FILE_TYPEBOT_V3)) {
      // Se não existir, inicializa com um objeto vazio
      const db = {};
      writeJSONFileTypebotV3(DATABASE_FILE_TYPEBOT_V3, db);
  } else {
      // Se já existir, mantém os dados existentes
      console.log('Banco de dados V3 já existe e não será sobrescrito.');
  }
}

function addToDBTypebotV3(url, disparoConfig) {
  const db = readJSONFileTypebotV3(DATABASE_FILE_TYPEBOT_V3);
  
  // Adiciona ao banco de dados
  db[url] = {
      ...disparoConfig,
      url_registro: url,
      disparo: disparoConfig.disparo // Converte a data futura para string ISO
  };

  writeJSONFileTypebotV3(DATABASE_FILE_TYPEBOT_V3, db);
}

function removeFromDBTypebotV3(url) {
    const db = readJSONFileTypebotV3(DATABASE_FILE_TYPEBOT_V3);
    delete db[url];
    writeJSONFileTypebotV3(DATABASE_FILE_TYPEBOT_V3, db);
}

function updateDBTypebotV3(url, newDisparoConfig) {
    const db = readJSONFileTypebotV3(DATABASE_FILE_TYPEBOT_V3);
    if (db[url]) {
        db[url] = {
            ...newDisparoConfig,
            disparo: newDisparoConfig.disparo.toISOString()  // Garante que a data é uma string
        };
        writeJSONFileTypebotV3(DATABASE_FILE_TYPEBOT_V3, db);
    }
}

function readFromDBTypebotV3(url) {
    const db = readJSONFileTypebotV3(DATABASE_FILE_TYPEBOT_V3);
    const config = db[url];
    if (config && config.disparo) {
        config.disparo = new Date(config.disparo);  // Reconverte a string para um objeto Date
    }
    return config;
}

function listAllFromDBTypebotV3() {
    const db = readJSONFileTypebotV3(DATABASE_FILE_TYPEBOT_V3);
    Object.keys(db).forEach(key => {
        if (db[key].disparo) {
            db[key].disparo = new Date(db[key].disparo);  // Reconverte as strings para objetos Date
        }
    });
    return db;
}

function readJSONFileTypebotV3(filename) {
    try {
        return JSON.parse(fs.readFileSync(filename, 'utf8'));
    } catch (error) {
        return {};
    }
}

function writeJSONFileTypebotV3(filename, data) {
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
}

// Fim das rotinas de disparo do remarketing

// Inicio das rotinas de disparo de Remarketing Agendados

const DATABASE_FILE_TYPEBOT_V4 = 'typebotDBV4.json';

async function initializeDBTypebotV4() {
  if (!fs.existsSync(DATABASE_FILE_TYPEBOT_V4)) {
    const db = {};
    writeJSONFileTypebotV4(DATABASE_FILE_TYPEBOT_V4, db);
  } else {
    const db = readJSONFileTypebotV4(DATABASE_FILE_TYPEBOT_V4);

    for (const whatsappNumber in db) {
      if (db.hasOwnProperty(whatsappNumber)) {
        db[whatsappNumber].forEach(agendamentoConfig => {
          const dataAgendamento = new Date(agendamentoConfig.dataAgendamento);
          if (dataAgendamento > new Date()) {
            // Chama scheduleAction diretamente para cada agendamento
            scheduleAction(dataAgendamento, agendamentoConfig.url_registro, agendamentoConfig.name, whatsappNumber, agendamentoConfig.msg);
          }
        });
      }
    }
  }
}

// Supõe-se que as funções scheduleAction, writeJSONFileTypebotV4 e readJSONFileTypebotV4 estejam definidas

function addToDBTypebotV4(whatsappNumber, agendamentoConfig) {
  const db = readJSONFileTypebotV4(DATABASE_FILE_TYPEBOT_V4);
  if (!db[whatsappNumber]) {
    db[whatsappNumber] = [];
  }
  db[whatsappNumber].push({
    ...agendamentoConfig,
    dataAgendamento: agendamentoConfig.dataAgendamento.toISOString()
  });
  writeJSONFileTypebotV4(DATABASE_FILE_TYPEBOT_V4, db);
}

function updateDBTypebotV4(whatsappNumber, url, newAgendamentoConfig) {
  const db = readJSONFileTypebotV4(DATABASE_FILE_TYPEBOT_V4);
  if (db[whatsappNumber]) {
    const index = db[whatsappNumber].findIndex(config => config.url_registro === url);
    if (index !== -1) {
      db[whatsappNumber][index] = {
        ...newAgendamentoConfig,
        dataAgendamento: newAgendamentoConfig.dataAgendamento.toISOString()
      };
      writeJSONFileTypebotV4(DATABASE_FILE_TYPEBOT_V4, db);
    }
  }
}

function removeFromDBTypebotV4withNumberAndURL(whatsappNumber, url) {
  const db = readJSONFileTypebotV4(DATABASE_FILE_TYPEBOT_V4);
  if (db[whatsappNumber]) {
    db[whatsappNumber] = db[whatsappNumber].filter(config => config.url_registro !== url);
    writeJSONFileTypebotV4(DATABASE_FILE_TYPEBOT_V4, db);
  }
}

function removeFromDBTypebotV4(whatsappNumber) {
  const db = readJSONFileTypebotV4(DATABASE_FILE_TYPEBOT_V4);
  delete db[whatsappNumber];
  writeJSONFileTypebotV4(DATABASE_FILE_TYPEBOT_V4, db);
}

function removeFromDBTypebotV4withURL(url) {
  const db = readJSONFileTypebotV4(DATABASE_FILE_TYPEBOT_V4);
  let isModified = false;

  for (const whatsappNumber in db) {
      if (db.hasOwnProperty(whatsappNumber) && db[whatsappNumber].url_registro === url) {
          delete db[whatsappNumber];
          isModified = true;
      }
  }

  // Atualiza o arquivo apenas se alguma alteração foi feita
  if (isModified) {
      writeJSONFileTypebotV4(DATABASE_FILE_TYPEBOT_V4, db);
  }
}

function readFromDBTypebotV4(whatsappNumber) {
    const db = readJSONFileTypebotV4(DATABASE_FILE_TYPEBOT_V4);
    const config = db[whatsappNumber];
    if (config && config.dataAgendamento) {
        config.dataAgendamento = new Date(config.dataAgendamento);
    }
    return config;
}

function listAllFromDBTypebotV4() {
    const db = readJSONFileTypebotV4(DATABASE_FILE_TYPEBOT_V4);
    Object.keys(db).forEach(key => {
        if (db[key].dataAgendamento) {
            db[key].dataAgendamento = new Date(db[key].dataAgendamento);
        }
    });
    return db;
}

function readJSONFileTypebotV4(filename) {
    try {
        return JSON.parse(fs.readFileSync(filename, 'utf8'));
    } catch (error) {
        return {};
    }
}

function writeJSONFileTypebotV4(filename, data) {
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
}

// Final das rotinas de disparo de Remarketing Agendados

// Inicio das rotinas de disparo para Grupos

const DATABASE_FILE_TYPEBOT_V5 = 'typebotDBV5.json';

async function initializeDBTypebotV5() {
  if (!fs.existsSync(DATABASE_FILE_TYPEBOT_V5)) {
      const db = {};
      writeJSONFileTypebotV5(DATABASE_FILE_TYPEBOT_V5, db);
  } else {
      console.log('Banco de dados V5 já existe e não será sobrescrito.');

      // Reagenda os disparos para os grupos registrados
      const db = readJSONFileTypebotV5(DATABASE_FILE_TYPEBOT_V5);
      for (const groupID in db) {
          if (db.hasOwnProperty(groupID)) {
              processGroupMessages(groupID, isFirstRun = true);
          }
      }
  }
}

function addToDBTypebotV5(groupID, message) {
  const db = readJSONFileTypebotV5(DATABASE_FILE_TYPEBOT_V5);
  if (!db[groupID]) {
    db[groupID] = { 
      messages: [message],
      nextIndex: 0,
      nextDispatchTime: new Date().toISOString()
    };
  } else {
    db[groupID].messages.push(message);
  }
  writeJSONFileTypebotV5(DATABASE_FILE_TYPEBOT_V5, db);
}

function updateNextDispatchV5(groupID, nextIndex, nextDispatchTime) {
  const db = readJSONFileTypebotV5(DATABASE_FILE_TYPEBOT_V5);
  if (db[groupID]) {
    db[groupID].nextIndex = nextIndex;
    db[groupID].nextDispatchTime = nextDispatchTime.toISOString();
    writeJSONFileTypebotV5(DATABASE_FILE_TYPEBOT_V5, db);
  }
}

function removeFromDBTypebotV5(groupID) {
  const db = readJSONFileTypebotV5(DATABASE_FILE_TYPEBOT_V5);
  delete db[groupID];
  writeJSONFileTypebotV5(DATABASE_FILE_TYPEBOT_V5, db);
}

function addMessageToGroupInV5(groupID, messageObj) {
  const db = readJSONFileTypebotV5(DATABASE_FILE_TYPEBOT_V5);

  // Inicializa a entrada do grupo, se necessário
  db[groupID] = db[groupID] || { messages: [], nextIndex: 0, nextDispatchTime: new Date().toISOString() };

  // Verifica se é um comando !wait
  if (messageObj.type === 'text' && typeof messageObj.content === 'string' && messageObj.content.startsWith('!wait')) {
      const waitTime = messageObj.content.split(' ')[1];
      db[groupID].messages.push({ type: 'wait', content: waitTime });
  } else {
      // Adiciona outros tipos de mensagens (texto normal, imagem, vídeo, áudio, etc.)
      db[groupID].messages.push(messageObj);
  }

  writeJSONFileTypebotV5(DATABASE_FILE_TYPEBOT_V5, db);
}

function readJSONFileTypebotV5(filename) {
  try {
    return JSON.parse(fs.readFileSync(filename, 'utf8'));
  } catch (error) {
    return {};
  }
}

function writeJSONFileTypebotV5(filename, data) {
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
}

function listAllFromDBTypebotV5() {
  const db = readJSONFileTypebotV5(DATABASE_FILE_TYPEBOT_V5);
  return Object.keys(db);
}

function groupIDExistsInV5(groupID) {
  const db = readJSONFileTypebotV5(DATABASE_FILE_TYPEBOT_V5);
  return db.hasOwnProperty(groupID);
}

const groupProcesses = {}; // Armazena o estado de processamento para cada grupo

async function processGroupMessages(groupID, isFirstRun = true) {
  if (groupProcesses[groupID]) {
      console.log(`Processo de mensagem já em andamento para o grupo ${groupID}.`);
      return;
  }

  groupProcesses[groupID] = true;

  const processMessage = async () => {
      const db = readJSONFileTypebotV5(DATABASE_FILE_TYPEBOT_V5);
      const groupConfig = db[groupID];

      if (!groupConfig || !groupConfig.messages || groupConfig.messages.length === 0) {
          console.log(`Nenhuma configuração de mensagem encontrada para o grupo ${groupID}.`);
          groupProcesses[groupID] = false;
          return;
      }

      // Ajuste para pular a primeira mensagem de espera somente na primeira execução
      if (isFirstRun && groupConfig.nextIndex === 0 && groupConfig.messages.length > 1) {
          groupConfig.nextIndex = 1;
      }

      const currentTime = new Date();
      const nextDispatchTime = new Date(groupConfig.nextDispatchTime);

      if (currentTime >= nextDispatchTime) {
          if (groupConfig.nextIndex >= groupConfig.messages.length) {
              groupConfig.nextIndex = 0; // Resetar o índice se ele exceder o comprimento do array
          }

          const messageObj = groupConfig.messages[groupConfig.nextIndex];
          let waitSeconds = 7; // Tempo padrão em segundos

          if (messageObj && messageObj.type === 'wait') {
              waitSeconds = parseInt(messageObj.content);
          } else if (messageObj && messageObj.type === 'text') {
              await sendRequest(groupID, messageObj.content, 'text');              
          } else if (messageObj && ['image', 'video', 'audio'].includes(messageObj.type)) {
              const mediaData = await getBase64Data(messageObj.content.content.url);
              if (mediaData) {                
                  await sendMediaRequest(groupID, mediaData, messageObj.type);                  
              } else {
                  console.error('Falha ao obter dados de mídia');
              }
          }

          let nextIndex = (groupConfig.nextIndex + 1) % groupConfig.messages.length;
          const newDispatchTime = new Date(currentTime.getTime() + waitSeconds * 1000);
          updateNextDispatchV5(groupID, nextIndex, newDispatchTime);
      }

      const timeUntilNextDispatch = nextDispatchTime.getTime() - new Date().getTime();
      setTimeout(processMessage, Math.max(timeUntilNextDispatch, 0));
  };

  processMessage();
}

async function sendRequest(groupID, content, type) {
  let retries = 0;
  const maxRetries = 15;
  let delay = init_delay;

  const sendMessage = async () => {
      try {
          const response = await fetch('http://localhost:3000/sendMessage', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  destinatario: groupID,
                  mensagem: content,
                  tipo: type
              })
          });

          if (!response.ok) {
              throw new Error(`Request failed with status ${response.status}`);
          }

          return await response.json();
      } catch (error) {
          if (retries < maxRetries) {
              retries++;
              console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
              await new Promise(resolve => setTimeout(resolve, delay));
              delay *= 2;
          } else {
              throw error;
          }
      }
  };

  while (retries < maxRetries) {
      try {
          await sendMessage();
          break;
      } catch (error) {
          if (retries === maxRetries) {
              console.error('Erro: Número máximo de tentativas de envio atingido.');
          }
      }
  }
}

async function sendMediaRequest(groupID, media, type) {
  let retries = 0;
  const maxRetries = 15;
  let delay = init_delay;

  const sendMedia = async () => {
      try {
          const response = await fetch('http://localhost:3000/sendMessage', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  destinatario: groupID,
                  media: media, // Aqui, 'media' é o objeto com mimetype, data e filename
                  tipo: type
              })
          });

          if (!response.ok) {
              throw new Error(`Request failed with status ${response.status}`);
          }

          return await response.json();
      } catch (error) {
          if (retries < maxRetries) {
              retries++;
              console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
              await new Promise(resolve => setTimeout(resolve, delay));
              delay *= 2;
          } else {
              throw error;
          }
      }
  };

  while (retries < maxRetries) {
      try {
          await sendMedia();
          break;
      } catch (error) {
          if (retries === maxRetries) {
              console.error('Erro: Número máximo de tentativas de envio atingido.');
          }
      }
  }
}

async function getBase64Data(fileUrl) {
  try {
      // Fazendo a requisição para obter o arquivo de mídia
      const response = await axios.get(fileUrl, {
          responseType: 'arraybuffer',
      });

      // Extraindo o tipo MIME e o nome do arquivo
      const mimetype = response.headers['content-type'];
      const filename = fileUrl.split("/").pop();

      // Convertendo os dados do arquivo para base64
      const base64Data = Buffer.from(response.data, 'binary').toString('base64');

      // Retornando um objeto com os dados necessários
      return { mimetype, data: base64Data, filename };
  } catch (e) {
      console.error('Erro ao processar mídia:', e);
      return null; // Retorna null em caso de falha na obtenção dos dados
  }
}

// Final das rotinas de disparo para Grupos

async function createSessionJohnny(data, url_registro, fluxo) {
  const chat = await data.getChat();

  const reqData = JSON.stringify({
    isStreamEnabled: true,
    message: "string", // Substitua se necessário
    resultId: "string", // Substitua se necessário
    isOnlyRegistering: false,
    prefilledVariables: {
      number: data.from.split('@')[0],
      name: data.notifyName
    },
  });

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: url_registro,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    data: reqData
  };

  try {   

    const response = await axios.request(config);

    const messages = response.data.messages;

    if (!existsDB(data.from) && reinit === false) {
      addObject(data.from, response.data.sessionId, data.from.replace(/\D/g, ''), JSON.stringify(data.id.id), 'typing', fluxo, false, "active", false, false, null, db_length);
    }
    
    for (const message of messages){
      
      if (message.type === 'text') {
        let formattedText = '';
        for (const richText of message.content.richText) {
          for (const element of richText.children) {
            let text = '';
    
            if (element.text) {
              text = element.text;
            } else if (element.type === 'inline-variable') {              
              text = element.children[0].children[0].text;
            }
    
            if (element.bold) {
              text = `*${text}*`;
            }
            if (element.italic) {
              text = `_${text}_`;
            }
            if (element.underline) {
              text = `~${text}~`;
            }
    
            formattedText += text;
          }
          formattedText += '\n';
        }
    
        formattedText = formattedText.replace(/\n$/, '');
        if (formattedText.startsWith('!wait')) {
          await waitWithDelay(formattedText);
        }
        if (formattedText.startsWith('!fim')) {
          if (existsDB(data.from)) {
            updateFlow(data.from, "inactive");
          }
        }
        if (formattedText.startsWith('!optout')) {
          if (existsDB(data.from)) {
            updateOptout(data.from, true);
            removeFromDBTypebotV4(data.from);
          }
        }
        if (formattedText.startsWith('!reiniciar')) {
          if (existsDB(data.from)) {
            deleteObject(data.from);
            reinit = true;
          }
        }
        if (formattedText.startsWith('!entenderaudio')) {          
          if (existsDB(data.from)) {
            updateNextAudio(data.from, true);
          }
        }
        if (formattedText.startsWith('!entenderimagem')) {          
          if (existsDB(data.from)) {
            updateNextImage(data.from, true);
            updatePrompt(data.from, formattedText.split(' ').slice(1).join(' '));
          }
        }
        if (formattedText.startsWith('!audioopenai')) {          
          if (existsDB(data.from)) {
      
              try {
                  // Sintetizar a fala
                  await brokerMaster(sintetizarFalaOpenAI, formattedText.split(' ').slice(2).join(' '), data.from.split('@c.us')[0], formattedText.split(' ')[1]);
      
                  // Caminho do arquivo de áudio gerado
                  const mediaPath = `audiosintetizado/${data.from.split('@c.us')[0]}.ogg`;
      
                  // Aqui você insere a lógica para tratar a mídia, se necessário
                  const media = await tratarMidia(mediaPath);
      
                  let retries = 0;
                  const maxRetries = 15; // Máximo de tentativas
                  let delay = init_delay; // Tempo inicial de espera em milissegundos
      
                  const sendRequest = async () => {
                      const response = await fetch('http://localhost:3000/sendMessage', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                              destinatario: data.from,
                              media: media,
                              tipo: "audio",                    
                              msg: data
                          })
                      });
      
                      if (!response.ok) {
                          throw new Error(`Request failed with status ${response.status}`);
                      }
      
                      return await response.json();
                  };
      
                  while (retries < maxRetries) {
                      try {
                          await sendRequest();
                          restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                          break; // Sai do loop se a requisição for bem-sucedida
                      } catch (error) {
                          retries++;
                          console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                          if (!restartAPI) {
                              myEmitter.emit('errorEvent', error);
                              restartAPI = true;
                          }
                          await new Promise(resolve => setTimeout(resolve, delay));
                          delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
                      }
                  }
      
                  if (retries === maxRetries) {
                      console.error('Erro: Número máximo de tentativas de envio atingido.');
                  }
      
              } catch (error) {
                  console.error('Erro ao sintetizar fala:', error);
              }
          }
        }
        if (formattedText.startsWith('!audioeleven')) {
          if (existsDB(data.from)) {
      
              try {
                  // Extrai o nome da voz e o texto a ser sintetizado do comando
                  // Sintetizar a fala usando ElevenLabs
                  await brokerMaster(sintetizarFalaEleven, formattedText.split(' ').slice(2).join(' '), data.from.split('@c.us')[0], formattedText.split(' ')[1]);
      
                  // Caminho do arquivo de áudio gerado
                  const mediaPath = `audiosintetizado/${data.from.split('@c.us')[0]}.ogg`;
      
                  // Aqui você insere a lógica para tratar a mídia, se necessário
                  const media = await tratarMidia(mediaPath);
      
                  let retries = 0;
                  const maxRetries = 15; // Máximo de tentativas
                  let delay = init_delay; // Tempo inicial de espera em milissegundos
      
                  const sendRequest = async () => {
                      const response = await fetch('http://localhost:3000/sendMessage', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                              destinatario: data.from,
                              media: media,
                              tipo: "audio",                    
                              msg: ""
                          })
                      });
      
                      if (!response.ok) {
                          throw new Error(`Request failed with status ${response.status}`);
                      }
      
                      return await response.json();
                  };
      
                  while (retries < maxRetries) {
                      try {
                          await sendRequest();
                          restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                          break; // Sai do loop se a requisição for bem-sucedida
                      } catch (error) {
                          retries++;
                          console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                          if (!restartAPI) {
                              myEmitter.emit('errorEvent', error);
                              restartAPI = true;
                          }
                          await new Promise(resolve => setTimeout(resolve, delay));
                          delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
                      }
                  }
      
                  if (retries === maxRetries) {
                      console.error('Erro: Número máximo de tentativas de envio atingido.');
                  }
      
              } catch (error) {
                  console.error('Erro ao sintetizar fala com ElevenLabs:', error);
              }
          }
        }
        if (formattedText.startsWith('!imagemopenai')) {
          await runDallE(formattedText.split(' ').slice(1).join(' '), 'imagemliquida', data.from.split('@c.us')[0])
              .then(async (filePath) => {
                  // Verifica se a imagem existe antes de enviar
                  while (true) {
                try {
                    if (fs.existsSync(filePath)) {
                        await Jimp.read(filePath); // Tenta ler a imagem
                        break; // Se a imagem for lida sem erros, saia do loop
                    }
                } catch (error) {
                    console.log("A imagem ainda está sendo renderizada...");
                }
                await new Promise(resolve => setTimeout(resolve, 1000)); // Aguarda 1 segundo
            }
      
                  let retries = 0;
                  const maxRetries = 15; // Máximo de tentativas
                  let delay = init_delay; // Tempo inicial de espera em milissegundos
      
                  const sendRequest = async () => {
                      const media = await tratarMidia(filePath);
                      const response = await fetch('http://localhost:3000/sendMessage', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                              destinatario: data.from,
                              media: media,
                              tipo: "image",
                              msg: "" // Mensagem opcional
                          })
                      });
      
                      if (!response.ok) {
                          throw new Error(`Request failed with status ${response.status}`);
                      }
      
                      return await response.json();
                  };
      
                  while (retries < maxRetries) {
                    try {
                        await sendRequest();
                        restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                        break; // Sai do loop se a requisição for bem-sucedida
                    } catch (error) {
                        retries++;
                        console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                        if (!restartAPI) {
                            myEmitter.emit('errorEvent', error);
                            restartAPI = true;
                        }
                        await new Promise(resolve => setTimeout(resolve, delay));
                        delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
                    }
                }
      
                  if (retries === maxRetries) {
                      console.error('Erro: Número máximo de tentativas de envio atingido.');
                  } else {
                      // Apagar a imagem após o envio bem-sucedido
                      fs.unlink(filePath, (err) => {
                          if (err) console.error('Erro ao apagar a imagem:', err);
                          else console.log(`Imagem ${filePath} apagada com sucesso.`);
                      });
                  }
              })
              .catch((error) => console.error("Erro durante a geração da imagem:", error));
        }  
        if (!(formattedText.startsWith('!wait')) && !(formattedText.startsWith('!fim')) && !(formattedText.startsWith('!optout')) && !(formattedText.startsWith('!reiniciar')) && !(formattedText.startsWith('!entenderaudio')) && !(formattedText.startsWith('!entenderimagem')) && !(formattedText.startsWith('!audioopenai')) && !(formattedText.startsWith('!audioeleven'))  && !(formattedText.startsWith('!imagemopenai'))) {
          let retries = 0;
          const maxRetries = 15; // Máximo de tentativas
          let delay = init_delay; // Tempo inicial de espera em milissegundos
          
      
          const sendRequest = async () => {
              await chat.sendStateTyping(); // Simulando Digitação
              const response = await fetch('http://localhost:3000/sendMessage', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      destinatario: data.from,
                      mensagem: formattedText,
                      tipo: "text",
                      msg: data
                  })
              });
      
              if (!response.ok) {
                  throw new Error(`Request failed with status ${response.status}`);
              }
      
              return await response.json();
          };
      
          while (retries < maxRetries) {
              try {
                  await sendRequest();
                  restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                  break; // Sai do loop se a requisição for bem-sucedida
              } catch (error) {
                  retries++;
                  console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                  if (!restartAPI) {
                      myEmitter.emit('errorEvent', error);
                      restartAPI = true;
                  }
                  await new Promise(resolve => setTimeout(resolve, delay));
                  delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
              }
          }
      
          if (retries === maxRetries) {
              console.error('Erro: Número máximo de tentativas de envio atingido.');
          }
      }      
      }
      if (message.type === 'image') {
        let retries = 0;
        const maxRetries = 15; // Máximo de tentativas
        let delay = init_delay; // Tempo inicial de espera em milissegundos
       
    
        const sendRequest = async () => {
            const media = await tratarMidia(message);
            const response = await fetch('http://localhost:3000/sendMessage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    destinatario: data.from,
                    media: media,
                    tipo: "image",
                    msg: data
                })
            });
    
            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }
    
            return await response.json();
        };
    
        while (retries < maxRetries) {
            try {
                await sendRequest();
                restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                break; // Sai do loop se a requisição for bem-sucedida
            } catch (error) {
                retries++;
                console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                if (!restartAPI) {
                    myEmitter.emit('errorEvent', error);
                    restartAPI = true;
                }
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
            }
        }
    
        if (retries === maxRetries) {
            console.error('Erro: Número máximo de tentativas de envio atingido.');
        }
      }                          
      if (message.type === 'video') {
        let retries = 0;
        const maxRetries = 15; // Máximo de tentativas
        let delay = init_delay; // Tempo inicial de espera em milissegundos
        
    
        const sendRequest = async () => {
            const media = await tratarMidia(message);
            const response = await fetch('http://localhost:3000/sendMessage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    destinatario: data.from,
                    media: media,
                    tipo: "video",
                    msg: data
                })
            });
    
            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }
    
            return await response.json();
        };
    
        while (retries < maxRetries) {
            try {
                await sendRequest();
                restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                break; // Sai do loop se a requisição for bem-sucedida
            } catch (error) {
                retries++;
                console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                if (!restartAPI) {
                    myEmitter.emit('errorEvent', error);
                    restartAPI = true;
                }
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
            }
        }
    
        if (retries === maxRetries) {
            console.error('Erro: Número máximo de tentativas de envio atingido.');
        }
      }                            
      if (message.type === 'audio') {
        let retries = 0;
        const maxRetries = 15; // Máximo de tentativas
        let delay = init_delay; // Tempo inicial de espera em milissegundos
        
    
        const sendRequest = async () => {
            const media = await tratarMidia(message);
            await chat.sendStateRecording(); // Simulando áudio gravando
            const response = await fetch('http://localhost:3000/sendMessage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    destinatario: data.from,
                    media: media,
                    tipo: "audio",                    
                    msg: data
                })
            });
    
            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }
    
            return await response.json();
        };
    
        while (retries < maxRetries) {
            try {
                await sendRequest();
                restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                break; // Sai do loop se a requisição for bem-sucedida
            } catch (error) {
                retries++;
                console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                if (!restartAPI) {
                    myEmitter.emit('errorEvent', error);
                    restartAPI = true;
                }
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
            }
        }
    
        if (retries === maxRetries) {
            console.error('Erro: Número máximo de tentativas de envio atingido.');
        }
      } 
    }
    const input = response.data.input
    if (input) {
      if (input.type === 'choice input') {
        let formattedText = '';
        const items = input.items;
        let arrayoptions = [];
        for (const item of items) {
          formattedText += `▶️ ${item.content}\n`;
          arrayoptions.push(item.content);
        }
        //console.log(arrayoptions)
          // await msg.reply(new Poll('Winter or Summer?', [arrayoptions]));
          // formattedText = formattedText.replace(/\n$/, '');
          await client.sendMessage(data.from, new Poll('*Escolha uma resposta:*', arrayoptions));
        }
    }
    if(existsDB(data.from)){
      updateSessionId(data.from, response.data.sessionId);
      updateId(data.from, JSON.stringify(data.id.id));
      updateInteract(data.from, 'done');
      updateFlow(data.from, "active");
      updateName(data.from, fluxo);
    }
    if(reinit === true){
      reinit = false;
    }
  } catch (error) {
    console.log(error);
  }
}

async function waitWithDelay(inputString) {
    // Verifica se a string começa com '!wait'
    if (inputString.startsWith('!wait')) {
      // Extrai o número da string usando expressões regulares
      const match = inputString.match(/\d+/);
      
      if (match) {
        // Converte o número para um valor inteiro
        const delayInSeconds = parseInt(match[0]);
        
        // Aguarda o atraso usando o valor extraído
        await new Promise(resolve => setTimeout(resolve, delayInSeconds * 1000));
        
        //console.log(`Aguardou ${delayInSeconds} segundos.`);
      } else {
        const defaultDelayInSeconds = 3;
        await new Promise(resolve => setTimeout(resolve, defaultDelayInSeconds * 1000));
      }
    }
}

function getMimeType(filePath) {
  const mimeTypes = {
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4',
      '.jpeg': 'image/jpeg',
      '.jpg': 'image/jpeg',
      '.png': 'image/png',
      '.pdf': 'application/pdf',
      '.ogg': 'audio/ogg',
      // Adicione mais mapeamentos conforme necessário
  };

  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || 'application/octet-stream'; // Tipo padrão se não reconhecido
}

async function tratarMidia(filePath) {
  try {
      const attachment = await fsp.readFile(filePath, { encoding: 'base64' });
      const mimetype = getMimeType(filePath);
      const filename = path.basename(filePath);

      if (attachment) {
          const media = new MessageMedia(mimetype, attachment, filename);
          return media;
      }
  } catch (e) {
      console.error(e);
  }
}

// Inicializando banco de dados dos fluxos do Typebot
initializeDB();
// Inicializando banco de dados das respostas Rápidas
initializeDBTypebotV2();
// Inicializando banco de dados do remarketing
initializeDBTypebotV3();
// Inicializando banco de dados dos disparos agendados
initializeDBTypebotV4();
// Inicializando banco de dados dos disparos para grupos
initializeDBTypebotV5();

const apiInit = readURL(0);
let openai; // Declaração da variável fora do bloco if

if (apiInit) {    
    if (apiInit.openaikey) {      
      openai = new OpenAI({ apiKey: apiInit.openaikey }); // Inicialização da variável
    } else {
      console.error("Chave OpenAI não encontrada no objeto.");
    }
} else {
    console.error("Objeto não encontrado no banco de dados.");
}

client.on("disconnected", async (reason) => {
  try {
      console.info(`Disconnected session: ${session}, reason: ${reason}`);

      // Reinicia a sessão do WhatsApp após um curto atraso
      setTimeout(() => startWhatsAppSession(session), 2000);
  } catch (err) {
      console.error(`Error handling disconnection for session ${session}: ${err}`);
  }
});

function startWhatsAppSession(sessionName) {
  // Executar o comando para reiniciar o processo específico
  exec(`pm2 restart ${sessionName}`, (err, stdout, stderr) => {
      if (err) {
          console.error(`Erro ao tentar reiniciar a sessão ${sessionName}:`, err);
          return;
      }
      console.log(`Saída do comando de reinicialização para ${sessionName}:`, stdout);
  });
}

// Funções auxiliares como updateSessionStatus, clearSessionData e startWhatsAppSession devem estar definidas.

// Evento de recebimento de mensagens
client.on('message', async msg => {

  if(existsTheDBSystem() === false){
    return
  }
  
  const typebotKey = await readFluxo(msg.from);

  if (!typebotKey) {
    if (msg.from.endsWith('@c.us') && !msg.hasMedia) {
      const typebotConfigs = readJSONFile(DATABASE_FILE_TYPE); // Lê os dados do arquivo JSON
      for (const key in typebotConfigs) {
          if (typebotConfigs.hasOwnProperty(key)) {
              const typebotConfig = typebotConfigs[key];              
              
              // Verifica se a mensagem corresponde ao gatilho, ou se o gatilho é "null" e a mensagem não é nula
              if ((typebotConfig.gatilho === msg.body) || (typebotConfig.gatilho === "null" && msg.body !== null)) {
                  // Inicia a sessão com o Typebot correspondente
                  await createSessionJohnny(msg, typebotConfig.url_registro, typebotConfig.name);
                  await scheduleRemarketing(typebotConfig.name, msg.from, msg);
                  break; // Sai do loop após encontrar o gatilho correspondente
              }
          }
      }
    }    
   } else {
    if (existsDB(msg.from) && msg.from.endsWith('@c.us')  && readInteract(msg.from) === 'done' && readId(msg.from) !== JSON.stringify(msg.id.id) && msg.body !== null && readFlow(msg.from) === "active"){
      updateInteract(msg.from, 'typing');
      updateId(msg.from, JSON.stringify(msg.id.id));
      const chat = await msg.getChat();
        const sessionId = await readSessionId(msg.from);
        const content = await processMessageIA(msg);
        updateNextAudio(msg.from, false);
        updateNextImage(msg.from, false);
        const chaturl = `${readURL(0).url_chat}${sessionId}/continueChat`;
        
        const reqData = {
          message: content,
        };
      
        const config = {
          method: 'post',
          maxBodyLength: Infinity,
          url: chaturl,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          data: JSON.stringify(reqData),
        };
      
        try {
          const response = await axios.request(config);
          //console.log(JSON.stringify(response.data));
          const messages = response.data.messages;
          //console.log(JSON.stringify(messages));                  
          for (const message of messages){
            if (message.type === 'text') {
              let formattedText = '';
              for (const richText of message.content.richText) {
                for (const element of richText.children) {
                  let text = '';
          
                  if (element.text) {
                    text = element.text;
                  } else if (element.type === 'inline-variable') {              
                    text = element.children[0].children[0].text;
                  }
          
                  if (element.bold) {
                    text = `*${text}*`;
                  }
                  if (element.italic) {
                    text = `_${text}_`;
                  }
                  if (element.underline) {
                    text = `~${text}~`;
                  }
          
                  formattedText += text;
                }
                formattedText += '\n';
              }
          
              formattedText = formattedText.replace(/\n$/, '');
              if (formattedText.startsWith('!wait')) {
                await waitWithDelay(formattedText);
              }
              if (formattedText.startsWith('!fim')) {
                if (existsDB(msg.from)) {
                  updateFlow(msg.from, "inactive");
                }
              }
              if (formattedText.startsWith('!optout')) {
                if (existsDB(msg.from)) {
                  updateOptout(msg.from, true);
                  removeFromDBTypebotV4(msg.from);
                }
              }
              if (formattedText.startsWith('!reiniciar')) {
                if (existsDB(msg.from)) {
                  deleteObject(msg.from);
                }
              }
              if (formattedText.startsWith('!entenderaudio')) {          
                if (existsDB(msg.from)) {
                  updateNextAudio(msg.from, true);
                }
              }
              if (formattedText.startsWith('!entenderimagem')) {          
                if (existsDB(msg.from)) {
                  updateNextImage(msg.from, true);
                  updatePrompt(msg.from, formattedText.split(' ').slice(1).join(' '));
                }
              }
              if (formattedText.startsWith('!audioopenai')) {          
                if (existsDB(msg.from)) {
            
                    try {
                        // Sintetizar a fala
                        await brokerMaster(sintetizarFalaOpenAI, formattedText.split(' ').slice(2).join(' '), msg.from.split('@c.us')[0], formattedText.split(' ')[1]);
            
                        // Caminho do arquivo de áudio gerado
                        const mediaPath = `audiosintetizado/${msg.from.split('@c.us')[0]}.ogg`;
            
                        // Aqui você insere a lógica para tratar a mídia, se necessário
                        const media = await tratarMidia(mediaPath);
            
                        let retries = 0;
                        const maxRetries = 15; // Máximo de tentativas
                        let delay = init_delay; // Tempo inicial de espera em milissegundos
            
                        const sendRequest = async () => {
                            const response = await fetch('http://localhost:3000/sendMessage', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    destinatario: msg.from,
                                    media: media,
                                    tipo: "audio",                    
                                    msg: msg
                                })
                            });
            
                            if (!response.ok) {
                                throw new Error(`Request failed with status ${response.status}`);
                            }
            
                            return await response.json();
                        };
            
                        while (retries < maxRetries) {
                            try {
                                await sendRequest();
                                restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                                break; // Sai do loop se a requisição for bem-sucedida
                            } catch (error) {
                                retries++;
                                console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                                if (!restartAPI) {
                                    myEmitter.emit('errorEvent', error);
                                    restartAPI = true;
                                }
                                await new Promise(resolve => setTimeout(resolve, delay));
                                delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
                            }
                        }
            
                        if (retries === maxRetries) {
                            console.error('Erro: Número máximo de tentativas de envio atingido.');
                        }
            
                    } catch (error) {
                        console.error('Erro ao sintetizar fala:', error);
                    }
                }
              }
              if (formattedText.startsWith('!audioeleven')) {
          if (existsDB(msg.from)) {
      
              try {
                  // Extrai o nome da voz e o texto a ser sintetizado do comando
                  // Sintetizar a fala usando ElevenLabs
                  await brokerMaster(sintetizarFalaEleven, formattedText.split(' ').slice(2).join(' '), msg.from.split('@c.us')[0], formattedText.split(' ')[1]);
      
                  // Caminho do arquivo de áudio gerado
                  const mediaPath = `audiosintetizado/${msg.from.split('@c.us')[0]}.ogg`;
      
                  // Aqui você insere a lógica para tratar a mídia, se necessário
                  const media = await tratarMidia(mediaPath);
      
                  let retries = 0;
                  const maxRetries = 15; // Máximo de tentativas
                  let delay = init_delay; // Tempo inicial de espera em milissegundos
      
                  const sendRequest = async () => {
                      const response = await fetch('http://localhost:3000/sendMessage', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                              destinatario: msg.from,
                              media: media,
                              tipo: "audio",                    
                              msg: ""
                          })
                      });
      
                      if (!response.ok) {
                          throw new Error(`Request failed with status ${response.status}`);
                      }
      
                      return await response.json();
                  };
      
                  while (retries < maxRetries) {
                      try {
                          await sendRequest();
                          restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                          break; // Sai do loop se a requisição for bem-sucedida
                      } catch (error) {
                          retries++;
                          console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                          if (!restartAPI) {
                              myEmitter.emit('errorEvent', error);
                              restartAPI = true;
                          }
                          await new Promise(resolve => setTimeout(resolve, delay));
                          delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
                      }
                  }
      
                  if (retries === maxRetries) {
                      console.error('Erro: Número máximo de tentativas de envio atingido.');
                  }
      
              } catch (error) {
                  console.error('Erro ao sintetizar fala com ElevenLabs:', error);
              }
          }
              }
              if (formattedText.startsWith('!imagemopenai')) {
                
                await runDallE(formattedText.split(' ').slice(1).join(' '), 'imagemliquida', msg.from.split('@c.us')[0])
                    .then(async (filePath) => {
                        // Verifica se a imagem existe antes de enviar
                        while (true) {
                try {
                    if (fs.existsSync(filePath)) {
                        await Jimp.read(filePath); // Tenta ler a imagem
                        break; // Se a imagem for lida sem erros, saia do loop
                    }
                } catch (error) {
                    console.log("A imagem ainda está sendo renderizada...");
                }
                await new Promise(resolve => setTimeout(resolve, 1000)); // Aguarda 1 segundo
            }
            
                        let retries = 0;
                        const maxRetries = 15; // Máximo de tentativas
                        let delay = init_delay; // Tempo inicial de espera em milissegundos
            
                        const sendRequest = async () => {
                            const media = await tratarMidia(filePath);
                            const response = await fetch('http://localhost:3000/sendMessage', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    destinatario: msg.from,
                                    media: media,
                                    tipo: "image",
                                    msg: "" // Mensagem opcional
                                })
                            });
            
                            if (!response.ok) {
                                throw new Error(`Request failed with status ${response.status}`);
                            }
            
                            return await response.json();
                        };
            
                        while (retries < maxRetries) {
                          try {
                              await sendRequest();
                              restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                              break; // Sai do loop se a requisição for bem-sucedida
                          } catch (error) {
                              retries++;
                              console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                              if (!restartAPI) {
                                  myEmitter.emit('errorEvent', error);
                                  restartAPI = true;
                              }
                              await new Promise(resolve => setTimeout(resolve, delay));
                              delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
                          }
                      }
            
                        if (retries === maxRetries) {
                            console.error('Erro: Número máximo de tentativas de envio atingido.');
                        } else {
                            // Apagar a imagem após o envio bem-sucedido
                            fs.unlink(filePath, (err) => {
                                if (err) console.error('Erro ao apagar a imagem:', err);
                                else console.log(`Imagem ${filePath} apagada com sucesso.`);
                            });
                        }
                    })
                    .catch((error) => console.error("Erro durante a geração da imagem:", error));
              }  
              if (!(formattedText.startsWith('!wait')) && !(formattedText.startsWith('!fim')) && !(formattedText.startsWith('!optout')) && !(formattedText.startsWith('!reiniciar')) && !(formattedText.startsWith('!entenderaudio')) && !(formattedText.startsWith('!entenderimagem')) && !(formattedText.startsWith('!audioopenai')) && !(formattedText.startsWith('!audioeleven'))  && !(formattedText.startsWith('!imagemopenai'))) {
                let retries = 0;
                const maxRetries = 15; // Máximo de tentativas
                let delay = init_delay; // Tempo inicial de espera em milissegundos                           
            
                const sendRequest = async () => {
                    await chat.sendStateTyping(); // Simulando Digitação
                    const response = await fetch('http://localhost:3000/sendMessage', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            destinatario: msg.from,
                            mensagem: formattedText,
                            tipo: "text",
                            msg: msg
                        })
                    });
            
                    if (!response.ok) {
                        throw new Error(`Request failed with status ${response.status}`);
                    }
            
                    return await response.json();
                };
            
                while (retries < maxRetries) {
                    try {
                        await sendRequest();
                        restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                        break; // Sai do loop se a requisição for bem-sucedida
                    } catch (error) {
                        retries++;
                        console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                        if (!restartAPI) {
                            myEmitter.emit('errorEvent', error);
                            restartAPI = true;
                        }
                        await new Promise(resolve => setTimeout(resolve, delay));
                        delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
                    }
                }
            
                if (retries === maxRetries) {
                    console.error('Erro: Número máximo de tentativas de envio atingido.');
                }
            }                               
            }
            if (message.type === 'image') {
              let retries = 0;
              const maxRetries = 15; // Máximo de tentativas
              let delay = init_delay; // Tempo inicial de espera em milissegundos
              
          
              const sendRequest = async () => {
                  const media = await tratarMidia(message);
                  const response = await fetch('http://localhost:3000/sendMessage', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                          destinatario: msg.from,
                          media: media,
                          tipo: "image",
                          msg: msg
                      })
                  });
          
                  if (!response.ok) {
                      throw new Error(`Request failed with status ${response.status}`);
                  }
          
                  return await response.json();
              };
          
              while (retries < maxRetries) {
                  try {
                      await sendRequest();
                      restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                      break; // Sai do loop se a requisição for bem-sucedida
                  } catch (error) {
                      retries++;
                      console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                      if (!restartAPI) {
                          myEmitter.emit('errorEvent', error);
                          restartAPI = true;
                      }
                      await new Promise(resolve => setTimeout(resolve, delay));
                      delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
                  }
              }
          
              if (retries === maxRetries) {
                  console.error('Erro: Número máximo de tentativas de envio atingido.');
              }
            }                          
            if (message.type === 'video') {
              let retries = 0;
              const maxRetries = 15; // Máximo de tentativas
              let delay = init_delay; // Tempo inicial de espera em milissegundos
              
          
              const sendRequest = async () => {
                  const media = await tratarMidia(message);
                  const response = await fetch('http://localhost:3000/sendMessage', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                          destinatario: msg.from,
                          media: media,
                          tipo: "video",
                          msg: msg
                      })
                  });
          
                  if (!response.ok) {
                      throw new Error(`Request failed with status ${response.status}`);
                  }
          
                  return await response.json();
              };
          
              while (retries < maxRetries) {
                  try {
                      await sendRequest();
                      restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                      break; // Sai do loop se a requisição for bem-sucedida
                  } catch (error) {
                      retries++;
                      console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                      if (!restartAPI) {
                          myEmitter.emit('errorEvent', error);
                          restartAPI = true;
                      }
                      await new Promise(resolve => setTimeout(resolve, delay));
                      delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
                  }
              }
          
              if (retries === maxRetries) {
                  console.error('Erro: Número máximo de tentativas de envio atingido.');
              }
            }                            
            if (message.type === 'audio') {
              let retries = 0;
              const maxRetries = 15; // Máximo de tentativas
              let delay = init_delay; // Tempo inicial de espera em milissegundos
              
          
              const sendRequest = async () => {
                  const media = await tratarMidia(message);
                  await chat.sendStateRecording(); // Simulando áudio gravando
                  const response = await fetch('http://localhost:3000/sendMessage', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                          destinatario: msg.from,
                          media: media,
                          tipo: "audio",                    
                          msg: msg
                      })
                  });
          
                  if (!response.ok) {
                      throw new Error(`Request failed with status ${response.status}`);
                  }
          
                  return await response.json();
              };
          
              while (retries < maxRetries) {
                  try {
                      await sendRequest();
                      restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                      break; // Sai do loop se a requisição for bem-sucedida
                  } catch (error) {
                      retries++;
                      console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                      if (!restartAPI) {
                          myEmitter.emit('errorEvent', error);
                          restartAPI = true;
                      }
                      await new Promise(resolve => setTimeout(resolve, delay));
                      delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
                  }
              }
          
              if (retries === maxRetries) {
                  console.error('Erro: Número máximo de tentativas de envio atingido.');
              }
            }                           
          }
          const input = response.data.input
    if (input) {
      if (input.type === 'choice input') {
        let formattedText = '';
        const items = input.items;
        let arrayoptions = [];
        for (const item of items) {
          formattedText += `▶️ ${item.content}\n`;
          arrayoptions.push(item.content);
        }
        //console.log(arrayoptions)
          // await msg.reply(new Poll('Winter or Summer?', [arrayoptions]));
          // formattedText = formattedText.replace(/\n$/, '');
          await client.sendMessage(msg.from, new Poll('*Escolha uma resposta:*', arrayoptions));
        }
    }
          updateInteract(msg.from, 'done');
        } catch (error) {
          console.log(error);
        }        
    }
   } 

});

async function processMessageV2(msg, msgfrom) {
  const typebotConfigsV2 = readJSONFileTypebotV2(DATABASE_FILE_TYPEBOT_V2); // Lê os dados do banco de dados V2

  for (const key in typebotConfigsV2) {
      if (typebotConfigsV2.hasOwnProperty(key)) {
          const typebotConfigV2 = typebotConfigsV2[key];
          
          // Verifica se a mensagem corresponde ao gatilho
          if (typebotConfigV2.gatilho === msg.body) {
              const name = typebotConfigV2.name;
              
              // Agora, busca o registro correspondente no banco de dados principal
              const mainTypebotConfigs = readJSONFile(DATABASE_FILE_TYPE);
              const mainTypebotConfig = mainTypebotConfigs[name];

              if (mainTypebotConfig) {
                  // Se encontrou o registro, executa a adição da sessão
                  //deleteObject(msgfrom);
                  await createSessionJohnnyV2(msg, msgfrom, mainTypebotConfig.url_registro, mainTypebotConfig.name);
                  await scheduleRemarketing(mainTypebotConfig.name, msgfrom, msg);
                  break; // Sai do loop após encontrar o gatilho correspondente
              }
          }
      }
  }
}

async function processMessageRMKT(msg, msgfrom, url) {
  const typebotConfigsV3 = readJSONFileTypebotV3(DATABASE_FILE_TYPEBOT_V3); // Lê os dados do banco de dados V3

  // Busca a configuração correspondente à URL fornecida
  const typebotConfigV3 = typebotConfigsV3[url];

  if (typebotConfigV3) {
      // Se encontrou o registro, executa a adição da sessão
      deleteObject(msgfrom);
      await createSessionJohnnyV2(msg, msgfrom, typebotConfigV3.url_registro, typebotConfigV3.name);
      //await createSessionJohnny(msg, typebotConfigV3.url_registro, typebotConfigV3.name);

  } else {
      console.log(`Nenhuma configuração encontrada para a URL: ${url}`);
  }
}

/*async function scheduleRemarketing(name, msgfrom, msg) {
  const remarketingConfigs = readJSONFileTypebotV3(DATABASE_FILE_TYPEBOT_V3);
  for (const url in remarketingConfigs) {
      if (remarketingConfigs.hasOwnProperty(url)) {
          const config = remarketingConfigs[url];
          if (config.name === name) {
              const minutosParaAdicionar = parseInt(config.disparo, 10);
              if (!isNaN(minutosParaAdicionar)) {
                  const dataFutura = new Date();
                  dataFutura.setMinutes(dataFutura.getMinutes() + minutosParaAdicionar);

                  // Agende a ação de remarketing usando dataFutura
                  scheduleAction(dataFutura, url, name, msgfrom, msg);

                  // Adicione o agendamento ao banco de dados V4
                  const agendamentoConfig = {
                      url_registro: url,
                      dataAgendamento: dataFutura,
                      msg: msg
                  };
                  addToDBTypebotV4(msgfrom, agendamentoConfig);

                  console.log(`Agendado para: ${dataFutura} - URL: ${url}`);
              }
          }
      }
  }
}*/

async function scheduleRemarketing(name, msgfrom, msg) {
  const remarketingConfigs = readJSONFileTypebotV3(DATABASE_FILE_TYPEBOT_V3);
  for (const url in remarketingConfigs) {
      if (remarketingConfigs.hasOwnProperty(url)) {
          const config = remarketingConfigs[url];
          if (config.name === name) {
              const diasParaAdicionar = parseInt(config.disparo, 10);
              if (!isNaN(diasParaAdicionar)) {
                  const dataFutura = new Date();
                  dataFutura.setDate(dataFutura.getDate() + diasParaAdicionar); // Adiciona dias

                  // Agende a ação de remarketing usando dataFutura
                  scheduleAction(dataFutura, url, name, msgfrom, msg);

                  // Adicione o agendamento ao banco de dados V4
                  const agendamentoConfig = {
                      url_registro: url,
                      dataAgendamento: dataFutura,
                      msg: msg
                  };
                  addToDBTypebotV4(msgfrom, agendamentoConfig);

                  console.log(`Agendado para: ${dataFutura.toISOString()} - URL: ${url}`);
              }
          }
      }
  }
}

function scheduleAction(dataFutura, url, name, msgfrom, msg) {
  const agora = new Date();
  const delay = dataFutura.getTime() - agora.getTime(); // Calcula o tempo de espera em milissegundos

  if (delay <= 0) {
      console.log("A data de disparo já passou. Executando agora.");
      if(!readOptout(msgfrom)){
      deleteObject(msgfrom);
      processMessageRMKT(msg, msgfrom, url);
      removeFromDBTypebotV4withNumberAndURL(msgfrom, url);
      }
  } else {
      console.log(`Agendando ação de remarketing para ${dataFutura} (URL: ${url})`);
      
      // Agendar a ação
      setTimeout(() => {
          if(!readOptout(msgfrom)){
          deleteObject(msgfrom);          
          processMessageRMKT(msg, msgfrom, url);
          removeFromDBTypebotV4withNumberAndURL(msgfrom, url);
          }
      }, delay);

      // Registrar no banco de dados V4
      const agendamentoConfig = {
          url_registro: url,
          dataAgendamento: dataFutura,
          name: name
      };
      
      console.log(`Agendamento registrado para: ${msgfrom} - URL: ${url} - Data: ${dataFutura}`);
  }
}

let system_aux = false;

client.on('message_create', async (msg) => {

  // Comandos do central de controle
  if (msg.fromMe && msg.body.startsWith('!help') && msg.to === msg.from) {        
    
  // Chamar sendRequest ao invés de client.sendMessage
  await sendRequest(msg.from, `*Sistema de Controle v1.0 - TypeZapIA*

*Preparar Typebot (primeira ação)*
Comando: "!ativar"

*Adicionar Novo Fluxo*
Comando: "!adicionar"
      
*Excluir Fluxo*
Comando: "!excluir"
      
*Cadastrar Resposta Rápida*
Comando: "!rapida"
      
*Excluir Resposta Rápida*
Comando: "!rapidaexcluir"
      
*Adicionar Remarketing*
Comando: "!rmktadicionar"
      
*Excluir Remarketing*
Comando: "!rmktexcluir"
      
*Pegar o ID de um grupo*
Envie ao grupo: "Qual o id?"
      
*Excluir grupo*
Comando: "!grupoexcluir"
      
*Criar Lista de Grupo*
!listagrupo id_grupo listagrupo.json

*Carregar Lista para Disparo*
Comando: !listacarregar
      
*Disparar Mensagens*
!listadisparo lista.json min_delay max_delay init_pos end_pos nome_fluxo`, "text");    
  }

  // Configurar Main Infos do Systema
  if (msg.fromMe && msg.body === "!ativar" && !existsTheDBSystem() && msg.to === msg.from) {
    await sendRequest(msg.from, `*Vamos preparar o seu TypeZapIA*
Separe os seguintes itens: *URL do seu Typebot*, *API Key da OpenAI*, *API Key da ElevenLabs*

Resete o processo a qualquer momento digitando "00"

Vamos começar com a a URL do seu Typebot, por exemplo:
https://seutypebot.vm.elestio.app/api/v1/sessions/`, "text");
await delay(3000);
addObjectSelf(msg.from, 'stepAtivar01', JSON.stringify(msg.id.id), 'done', null, null, null);
  }

  if (msg.fromMe && msg.body !== null && msg.to === msg.from && !existsTheDBSystem() && existsDBSelf(msg.from) && readFlowSelf(msg.from) === 'stepAtivar01' && readIdSelf(msg.from) !== JSON.stringify(msg.id.id) && readInteractSelf(msg.from) === 'done' && !msg.hasMedia) {
    updateInteractSelf(msg.from, 'typing');
    updateIdSelf(msg.from, JSON.stringify(msg.id.id));
    updateURLRegistro(msg.from, msg.body);

await sendRequest(msg.from, `URL Registrada! 🚀

${readURLRegistro(msg.from)}

*Insira agora a API Key da OpenAI* 🤖`, "text");
await delay(2000);
    //addObjectSystem(await readURLRegistro(msg.from));
    updateFlowSelf(msg.from,'stepAtivar02');
    updateInteractSelf(msg.from, 'done');
    //deleteObjectSelf(msg.from);
    await delay(100);
  }

  if (msg.fromMe && msg.body !== null && msg.to === msg.from && !existsTheDBSystem() && existsDBSelf(msg.from) && readFlowSelf(msg.from) === 'stepAtivar02' && readIdSelf(msg.from) !== JSON.stringify(msg.id.id) && readInteractSelf(msg.from) === 'done' && !msg.hasMedia) {
    updateInteractSelf(msg.from, 'typing');
    updateIdSelf(msg.from, JSON.stringify(msg.id.id));    
    updateGatilho(msg.from, msg.body);

await sendRequest(msg.from, `API Key da OpenAI Registrada! 🚀

${readGatilho(msg.from)}

*Insira agora a API Key da ElevenLabs* 🤖`, "text");
await delay(2000);
    //addObjectSystem(await readURLRegistro(msg.from));
    updateFlowSelf(msg.from,'stepAtivar03');
    updateInteractSelf(msg.from, 'done');
    //deleteObjectSelf(msg.from);
    await delay(100);
  }

  if (msg.fromMe && msg.body !== null && msg.to === msg.from && !existsTheDBSystem() && existsDBSelf(msg.from) && readFlowSelf(msg.from) === 'stepAtivar03' && readIdSelf(msg.from) !== JSON.stringify(msg.id.id) && readInteractSelf(msg.from) === 'done' && !msg.hasMedia) {
    updateInteractSelf(msg.from, 'typing');
    updateIdSelf(msg.from, JSON.stringify(msg.id.id));
    updateName(msg.from, msg.body);

    // Obtendo as chaves API
    const url = await readURLRegistro(msg.from);
    const openaiKey = await readGatilho(msg.from);
    const elevenLabsKey = await readName(msg.from);

    // Inicializando os clientes
    initializeClient(openaiKey);

    await sendRequest(msg.from, `API ElevenLabs registrada! 🚀

    ${readName(msg.from)}

    *Pode usar o seu TypeZapIA!!* 🤖`, "text");
    await delay(2000);
    addObjectSystem(url, openaiKey, elevenLabsKey);
    updateFlowSelf(msg.from, 'stepAtivar04');
    updateInteractSelf(msg.from, 'done');
    deleteObjectSelf(msg.from);
    await delay(100);
}

  /*if (msg.fromMe && msg.body !== null && msg.to === msg.from && !existsTheDBSystem() && existsDBSelf(msg.from) && readFlowSelf(msg.from) === 'stepAtivar03' && readIdSelf(msg.from) !== JSON.stringify(msg.id.id) && readInteractSelf(msg.from) === 'done' && !msg.hasMedia) {
    updateInteractSelf(msg.from, 'typing');
    updateIdSelf(msg.from, JSON.stringify(msg.id.id));    
    updateName(msg.from, msg.body);

await sendRequest(msg.from, `API ElevenLabs registrada! 🚀

${readName(msg.from)}

*Pode usar o seu TypeZapIA!!* 🤖`, "text");
await delay(2000);
    addObjectSystem(await readURLRegistro(msg.from), await readGatilho(msg.from), await readName(msg.from));
    updateFlowSelf(msg.from,'stepAtivar04');
    updateInteractSelf(msg.from, 'done');
    deleteObjectSelf(msg.from);
    await delay(100);
  }*/

  // Resetar Step Self
  if (msg.fromMe && msg.body === "00" && msg.to === msg.from) {
    deleteObjectSelf(msg.from);
    await sendRequest(msg.from, `*Configuração resetada!*`, "text");
    await delay(2000);
  }

  //Adicionar novo fluxo
  if (msg.fromMe && msg.body === '!adicionar' && msg.to === msg.from && !existsDBSelf(msg.from) && !msg.hasMedia) { 
    await sendRequest(msg.from, `Entendido! 👍
Insira o link de registro completo do seu fluxo do Typebot. 📝
    
Por exemplo:\nhttps://seutype.vm.elestio.app/api/v1/typebots/seufunil/startChat\n 🛍️💬

_Resete o processo a qualquer momento digitando "00"_
*Insira o link abaixo* ⬇️`, "text");
    await delay(3000);
    addObjectSelf(msg.from, 'stepAdicionar01', JSON.stringify(msg.id.id), 'done', null, null, null);
   
  }

  if (msg.fromMe && msg.body !== null && msg.to === msg.from && existsDBSelf(msg.from) && readFlowSelf(msg.from) === 'stepAdicionar01' && readIdSelf(msg.from) !== JSON.stringify(msg.id.id) && readInteractSelf(msg.from) === 'done' && !msg.hasMedia) {
   updateInteractSelf(msg.from, 'typing');
    updateIdSelf(msg.from, JSON.stringify(msg.id.id));
    updateURLRegistro(msg.from, msg.body); 

await sendRequest(msg.from, `URL do fluxo adicionado com sucesso! 🚀

O URL que adicionei é:

${readURLRegistro(msg.from)}
    
Por favor, agora escreva o gatilho para ativar o seu fluxo. 🆔
Por exemplo:
QUERO SABER MAIS

*Vamos lá, escreva abaixo* 🤖👥`, "text");
await delay(2000);
    updateFlowSelf(msg.from,'stepAdicionar02');
    updateInteractSelf(msg.from, 'done');
  }

  if (msg.fromMe && msg.body !== null && msg.to === msg.from && existsDBSelf(msg.from) && readFlowSelf(msg.from) === 'stepAdicionar02' && readIdSelf(msg.from) !== JSON.stringify(msg.id.id) && readInteractSelf(msg.from) === 'done' && !msg.hasMedia) {
    updateInteractSelf(msg.from, 'typing');
    updateIdSelf(msg.from, JSON.stringify(msg.id.id));
    updateGatilho(msg.from, msg.body);

await sendRequest(msg.from, `Gatilho adicionado com sucesso! 🚀

O gatilho que adicionei é:

${readGatilho(msg.from)}
    
Por favor, agora escreva o nome do seu fluxo para identificação, evite espaços e caracteres especiais. 🆔
Por exemplo:
meufluxo

*Bora escolher um nome pro fluxo* 🤖👥`, "text");
await delay(2000);
    updateFlowSelf(msg.from,'stepAdicionar03');
    updateInteractSelf(msg.from, 'done');
    
  }

  if (msg.fromMe && msg.body !== null && msg.to === msg.from && existsDBSelf(msg.from) && readFlowSelf(msg.from) === 'stepAdicionar03' && readIdSelf(msg.from) !== JSON.stringify(msg.id.id) && readInteractSelf(msg.from) === 'done' && !msg.hasMedia) {
    updateInteractSelf(msg.from, 'typing');
    updateIdSelf(msg.from, JSON.stringify(msg.id.id));
    updateName(msg.from, msg.body);

await sendRequest(msg.from, `Nome adicionado com sucesso! 🚀

O nome que adicionei é:

${readName(msg.from)}
    
Vou preparar tudo e setar o novo fluxo.

*Preparando...* 🤖`, "text");
await delay(2000);
const typebotConfig = {
  url_registro: `${await readURLRegistro(msg.from)}`,
  gatilho: `${await readGatilho(msg.from)}`,
  name: `${await readName(msg.from)}`
  };
  addToDB(typebotConfig);

  await sendRequest(msg.from, `Concluido! 🚀

  Os fluxos ativos são:
  
  ${JSON.stringify((listAllFromDB()))}
  
  *Já pode usar o seu bot!* 🤖`, "text");
  await delay(2000);
    updateFlowSelf(msg.from,'stepAdicionar04');
    updateInteractSelf(msg.from, 'done');
    deleteObjectSelf(msg.from);
    await delay(1000);
  }

  //Excluir fluxo

  if (msg.fromMe && msg.body === '!excluir' && msg.to === msg.from && !existsDBSelf(msg.from) && !msg.hasMedia) { 
    
await sendRequest(msg.from, `Certo! 👍
Insira o nome do fluxo para ser excluido. 📝

_Resete o processo a qualquer momento digitando "00"_
*Escreva o nome abaixo* ⬇️`, "text");
     await delay(3000);
     addObjectSelf(msg.from, 'stepExcluir01', JSON.stringify(msg.id.id), 'done', null, null, null);
     
  }

  if (msg.fromMe && msg.body !== null && msg.to === msg.from && existsDBSelf(msg.from) && readFlowSelf(msg.from) === 'stepExcluir01' && readIdSelf(msg.from) !== JSON.stringify(msg.id.id) && readInteractSelf(msg.from) === 'done' && !msg.hasMedia) {
    
    updateInteractSelf(msg.from, 'typing');
    updateIdSelf(msg.from, JSON.stringify(msg.id.id));
    updateName(msg.from, msg.body);

await sendRequest(msg.from, `Buscando fluxo..

O fluxo que encontrei é:

${readFromDB(msg.body)}`, "text");
await delay(2000);
    removeFromDB(msg.body);

    await sendRequest(msg.from, '*Fluxo excluido com sucesso!* 🤖👥', "text");
    await delay(2000);
    updateFlowSelf(msg.from,'stepExcluir02');
    updateInteractSelf(msg.from, 'done');
    deleteObjectSelf(msg.from);
    await delay(2000);
  }

  //Cadastrar Resposta Rápida
  if (msg.fromMe && msg.body === '!rapida' && msg.to === msg.from && !existsDBSelf(msg.from) && !msg.hasMedia) { 
    
    await sendRequest(msg.from, `Entendido! 👍
Diga o nome do fluxo do Typebot já cadastrado. 📝

Por exemplo:\nmeufluxo\n 🛍️💬

_Resete o processo a qualquer momento digitando "00"_
*Escreva abaixo* ⬇️`,"text");
await delay(3000);
     addObjectSelf(msg.from, 'stepRapida01', JSON.stringify(msg.id.id), 'done', null, null, null);
     
  }

  if (msg.fromMe && msg.body !== null && msg.to === msg.from && existsDBSelf(msg.from) && readFlowSelf(msg.from) === 'stepRapida01' && readIdSelf(msg.from) !== JSON.stringify(msg.id.id) && readInteractSelf(msg.from) === 'done' && !msg.hasMedia) {
    
    updateInteractSelf(msg.from, 'typing');
    updateIdSelf(msg.from, JSON.stringify(msg.id.id));
    updateName(msg.from, msg.body);
        
    await sendRequest(msg.from, `Certo, busquei o fluxo! 🚀
    
Agora escreva a frase ou palavra chave para disparar o fluxo ao usuário. 🆔
Por exemplo: "Estou muito feliz por te receber aqui"

*Vamos lá, escreva abaixo* 🤖👥`,"text");
await delay(2000);
    updateFlowSelf(msg.from,'stepRapida02');
    updateInteractSelf(msg.from, 'done');
    
  }

  if (msg.fromMe && msg.body !== null && msg.to === msg.from && existsDBSelf(msg.from) && readFlowSelf(msg.from) === 'stepRapida02' && readIdSelf(msg.from) !== JSON.stringify(msg.id.id) && readInteractSelf(msg.from) === 'done' && !msg.hasMedia) {
    
    updateInteractSelf(msg.from, 'typing');
    updateIdSelf(msg.from, JSON.stringify(msg.id.id));
    updateGatilho(msg.from, msg.body);
        
    await sendRequest(msg.from, `Palavra ou Frase chave adicionada com sucesso! 🚀

O chave que adicionei é:

${readGatilho(msg.from)}

*Estou processando...* 🤖👥`,"text");
await delay(2000);
     const rapidoConfig = {  
     gatilho: `${await readGatilho(msg.from)}`,
     name: `${await readName(msg.from)}`
     };
    addToDBTypebotV2(await readName(msg.from),rapidoConfig);
    await sendRequest(msg.from, `Tudo pronto, pode disparar o fluxo agora! 🚀`,"text");
    await delay(2000);
    updateFlowSelf(msg.from,'stepRapida03');
    updateInteractSelf(msg.from, 'done');
    deleteObjectSelf(msg.from);
    
  } 

  //Excluir Resposta Rápida

  if (msg.fromMe && msg.body === '!rapidaexcluir' && msg.to === msg.from && !existsDBSelf(msg.from) && !msg.hasMedia) { 
    await sendRequest(msg.from, `Certo! 👍
Insira o nome da Resposta Rápida para ser excluida. 📝

_Resete o processo a qualquer momento digitando "00"_
*Escreva o nome abaixo* ⬇️`,"text");
await delay(3000);
     addObjectSelf(msg.from, 'stepRapidaExcluir01', JSON.stringify(msg.id.id), 'done', null, null, null);     
  }

  if (msg.fromMe && msg.body !== null && msg.to === msg.from && existsDBSelf(msg.from) && readFlowSelf(msg.from) === 'stepRapidaExcluir01' && readIdSelf(msg.from) !== JSON.stringify(msg.id.id) && readInteractSelf(msg.from) === 'done' && !msg.hasMedia) {
   
    updateInteractSelf(msg.from, 'typing');
    updateIdSelf(msg.from, JSON.stringify(msg.id.id));
    updateName(msg.from, msg.body);
        
    await sendRequest(msg.from, `Buscando Resposta Rápida..

${readFromDBTypebotV2(msg.body)}`,"text");
await delay(2000);
    removeFromDBTypebotV2(msg.body);
    await sendRequest(msg.from, '*Resposta Rápida excluida com sucesso!* 🤖👥',"text");
    await delay(2000);
    updateFlowSelf(msg.from,'stepRapidaExcluir02');
    updateInteractSelf(msg.from, 'done');
    deleteObjectSelf(msg.from);
    
  }

  //Adicionar Remarketing
  if (msg.fromMe && msg.body === '!rmktadicionar' && msg.to === msg.from && !existsDBSelf(msg.from) && !msg.hasMedia) { 
    
    await sendRequest(msg.from, `Entendido! 👍
Insira o link de registro completo do seu fluxo do Typebot para fazer dele um Remarketing. 📝

Por exemplo:\nhttps://seutype.vm.elestio.app/api/v1/typebots/funilremarketing/startChat\n 🛍️💬

_Resete o processo a qualquer momento digitando "00"_
*Insira o link abaixo* ⬇️`,"text");
await delay(3000);
     addObjectSelf(msg.from, 'stepRmkt01', JSON.stringify(msg.id.id), 'done', null, null, null);
     
  }

  if (msg.fromMe && msg.body !== null && msg.to === msg.from && existsDBSelf(msg.from) && readFlowSelf(msg.from) === 'stepRmkt01' && readIdSelf(msg.from) !== JSON.stringify(msg.id.id) && readInteractSelf(msg.from) === 'done' && !msg.hasMedia) {
    
    updateInteractSelf(msg.from, 'typing');
    updateIdSelf(msg.from, JSON.stringify(msg.id.id));
    updateURLRegistro(msg.from, msg.body);
        
    await sendRequest(msg.from, `URL adicionada com sucesso! 🚀

A URL que adicionei é:

${readURLRegistro(msg.from)}
    
Por favor, agora escreva o nome do fluxo principal (já existente) que irá se associar ao Remarketing. 🆔

*Bora associar ao fluxo principal* 🤖👥`,"text");
await delay(2000);
    updateFlowSelf(msg.from,'stepRmkt02');
    updateInteractSelf(msg.from, 'done');
    
  }

  if (msg.fromMe && msg.body !== null && msg.to === msg.from && existsDBSelf(msg.from) && readFlowSelf(msg.from) === 'stepRmkt02' && readIdSelf(msg.from) !== JSON.stringify(msg.id.id) && readInteractSelf(msg.from) === 'done' && !msg.hasMedia) {
    await delay(1000);
    updateInteractSelf(msg.from, 'typing');
    updateIdSelf(msg.from, JSON.stringify(msg.id.id));
    updateName(msg.from, msg.body);
        
    await sendRequest(msg.from, `Fluxo principal associado com sucesso! 🚀

O nome do fluxo que associei é:

${readName(msg.from)}
    
Agora forneça o tempo (em dias) para o Remarketing ser disparado.

*Escreva algo como 1 ou 5, por exemplo* 🤖`,"text");
await delay(2000);
    updateFlowSelf(msg.from,'stepRmkt03');
    updateInteractSelf(msg.from, 'done');
    await delay(2000);
  }

  if (msg.fromMe && msg.body !== null && msg.to === msg.from && existsDBSelf(msg.from) && readFlowSelf(msg.from) === 'stepRmkt03' && readIdSelf(msg.from) !== JSON.stringify(msg.id.id) && readInteractSelf(msg.from) === 'done' && !msg.hasMedia) {
    updateInteractSelf(msg.from, 'typing');
    updateIdSelf(msg.from, JSON.stringify(msg.id.id));
    updateGatilho(msg.from, msg.body);
        
    await sendRequest(msg.from, `Tempo de dias registrado! 🚀

Vou disparar esse remarketing em:

${readGatilho(msg.from)} dias

Vou preparar tudo e setar o novo Remarketing.

*Preparando...* 🤖`,"text");
await delay(2000);
    const urlRmkt = `${readURLRegistro(msg.from)}`;
    const typebotConfig = {
    disparo: `${await readGatilho(msg.from)}`,
    name: `${await readName(msg.from)}`
    };
    addToDBTypebotV3(urlRmkt,typebotConfig);

    await sendRequest(msg.from, `Concluido! 🚀

*Remarketing Registrado* 🤖`,"text");
await delay(2000);
    updateFlowSelf(msg.from,'stepRmkt04');
    updateInteractSelf(msg.from, 'done');
    deleteObjectSelf(msg.from);
  }

  //Excluir Remarketing
  if (msg.fromMe && msg.body === '!rmktexcluir' && msg.to === msg.from && !existsDBSelf(msg.from) && !msg.hasMedia) { 
    
    await sendRequest(msg.from, `Certo! 👍
Insira o URL do fluxo de Remarketing que iremos excluir. 📝

_Resete o processo a qualquer momento digitando "00"_
*Escreva o URL abaixo* ⬇️`,"text");
await delay(3000);
     addObjectSelf(msg.from, 'stepExcluirRmkt01', JSON.stringify(msg.id.id), 'done', null, null, null);
     
  }

  if (msg.fromMe && msg.body !== null && msg.to === msg.from && existsDBSelf(msg.from) && readFlowSelf(msg.from) === 'stepExcluirRmkt01' && readIdSelf(msg.from) !== JSON.stringify(msg.id.id) && readInteractSelf(msg.from) === 'done' && !msg.hasMedia) {
    
    updateInteractSelf(msg.from, 'typing');
    updateIdSelf(msg.from, JSON.stringify(msg.id.id));
    updateURLRegistro(msg.from, msg.body);
        
    await sendRequest(msg.from, `Buscando fluxo de Remarketing..`,"text");
    await delay(2000);
    removeFromDBTypebotV3(msg.body);
    removeFromDBTypebotV4withURL(msg.body);
    await sendRequest(msg.from, '*Fluxo de Remarketing excluido com sucesso!* 🤖👥',"text");
    await delay(2000);
    updateFlowSelf(msg.from,'stepExcluirRmkt02');
    updateInteractSelf(msg.from, 'done');
    deleteObjectSelf(msg.from);
    await delay(2000);
  }  

  //Excluir Grupo
  if (msg.fromMe && msg.body === '!grupoexcluir' && msg.to === msg.from && !existsDBSelf(msg.from) && !msg.hasMedia) { 
    
    await sendRequest(msg.from, `Certo! 👍
Insira o ID do grupo que iremos excluir. 📝

_Resete o processo a qualquer momento digitando "00"_    
*Escreva o ID abaixo* ⬇️`,"text");
await delay(3000);
     addObjectSelf(msg.from, 'stepExcluirGrupo01', JSON.stringify(msg.id.id), 'done', null, null, null);
     
  }

  if (msg.fromMe && msg.body !== null && msg.to === msg.from && existsDBSelf(msg.from) && readFlowSelf(msg.from) === 'stepExcluirGrupo01' && readIdSelf(msg.from) !== JSON.stringify(msg.id.id) && readInteractSelf(msg.from) === 'done' && !msg.hasMedia) {
    
    updateInteractSelf(msg.from, 'typing');
    updateIdSelf(msg.from, JSON.stringify(msg.id.id));
    updateURLRegistro(msg.from, msg.body);
        
    await sendRequest(msg.from, `Buscando Grupos..`,"text");
    await delay(2000);
    removeFromDBTypebotV5(msg.body);
    await sendRequest(msg.from, '*Grupo excluido com sucesso!* 🤖👥',"text");
    await delay(2000);
    updateFlowSelf(msg.from,'stepExcluirGrupo02');
    updateInteractSelf(msg.from, 'done');
    deleteObjectSelf(msg.from);
    
  }

  // Rotina de disparo

  if (msg.fromMe && msg.to !== msg.from) {    
    await processMessageV2(msg, msg.to);
  }

  //Pegar Id de um grupo

  if (msg.fromMe && msg.body === 'Qual o id?' && msg.to !== msg.from) {
    await sendRequest(msg.from, `O Id do grupo é:`,"text");
    await sendRequest(msg.from, `${msg.to}`,"text");
  }

  //Criar lista de Grupo  

  if (msg.fromMe && msg.body.startsWith('!listagrupo') && msg.to === msg.from) {
    const listaContatos = await extrairGrupo(await extrairNomeArquivo(msg.body, 1));
    await sendRequest(msg.from, `Lista de leads preparada: \n\n${listaContatos.slice(0, 5)}`, "text");
    const nomeArquivo = await extrairNomeArquivo(msg.body, 2);
    writeJSONFile(nomeArquivo, listaContatos);
    await sendRequest(msg.from, `Arquivo com os contatos pronto: \n\n${nomeArquivo}\n\nQuantidade de Contatos extraídos: ${listaContatos.length}`, "text");
  
    while (true) {
      try {
        // Verifica se o arquivo JSON existe na pasta
        if (fs.existsSync(`./${nomeArquivo}`)) {                
          const arquivoMedia = MessageMedia.fromFilePath(`./${nomeArquivo}`);
          //await client.sendMessage(msg.from, MessageMedia.fromFilePath(`./${nomeArquivo}.json`));
          await client.sendMessage(msg.from, arquivoMedia);
          break; // Encerra o loop após enviar o arquivo
        }
        // Aguarda 1 segundo antes de verificar novamente
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        console.error(err);
        break; // Encerra o loop em caso de erro
      }
    }
  }

  //Carregar Lista para disparo
  if (msg.fromMe && msg.body === '!listacarregar' && msg.to === msg.from && !existsDBSelf(msg.from) && !msg.hasMedia) { 
    await sendRequest(msg.from, `Entendido! 👍
Insira a lista JSON *formatada* para trabalharmos uma campanha de disparo. 📝
_(Arraste o arquivo ou compartilhe)_

_Resete o processo a qualquer momento digitando "00"_
*Carregue o arquivo abaixo* ⬇️`, "text");
    await delay(3000);
    addObjectSelf(msg.from, 'stepListaCarregar01', JSON.stringify(msg.id.id), 'done', null, null, null);   
  }

  if (msg.fromMe && msg.body !== null && msg.to === msg.from && existsDBSelf(msg.from) && readFlowSelf(msg.from) === 'stepListaCarregar01' && readIdSelf(msg.from) !== JSON.stringify(msg.id.id) && readInteractSelf(msg.from) === 'done' && msg.hasMedia) {
    updateInteractSelf(msg.from, 'typing');
    updateIdSelf(msg.from, JSON.stringify(msg.id.id));
    
    const attachmentData = await msg.downloadMedia();
    // Rotina para baixar a lista e salvar no diretório do projeto
    if (attachmentData) {
      const fileName = attachmentData.filename || 'lista.json'; // Define um nome padrão se o nome do arquivo não estiver disponível
      const filePath = path.join(__dirname, fileName); // __dirname representa o diretório atual do script
      fs.writeFileSync(filePath, attachmentData.data, 'base64'); // Salva o arquivo no formato base64
  
      await sendRequest(msg.from, `Arquivo JSON adicionado com sucesso! 🚀 
  
  *Já pode trabalhar a sua campanha de disparos* 🤖👥`, "text");
      await delay(2000);
      updateFlowSelf(msg.from, 'stepListaCarregar02');
      updateInteractSelf(msg.from, 'done');
      deleteObjectSelf(msg.from);
    } else {
      // Lidar com erro caso o arquivo não possa ser baixado
      await sendRequest(msg.from, `Houve um erro ao adicionar o arquivo. Por favor, tente novamente.`, "text");
    }
  }

  //Disparo para Lista

  if (msg.fromMe && msg.body.startsWith('!listadisparo') && msg.to === msg.from) {
    try {
        const listaContatos = readJSONFile(await extrairNomeArquivo(msg.body, 1));
        const init_pos = parseInt(await extrairNomeArquivo(msg.body, 4), 10);
        const end_pos = parseInt(await extrairNomeArquivo(msg.body, 5), 10);
        const min_delay = parseInt(await extrairNomeArquivo(msg.body, 2), 10);
        const max_delay = parseInt(await extrairNomeArquivo(msg.body, 3), 10);
        const fluxo = await extrairNomeArquivo(msg.body, 6);

        if (isNaN(init_pos) || isNaN(end_pos) || isNaN(min_delay) || isNaN(max_delay)) {
            throw new Error("Um ou mais parâmetros numéricos são inválidos.");
        }

        if (init_pos < 0 || end_pos < 0 || min_delay < 0 || max_delay < 0 || end_pos < init_pos) {
            throw new Error("Os valores de posição ou delay estão fora dos limites permitidos.");
        }

        const subListaContatos = listaContatos.slice(init_pos, end_pos + 1);

        await sendRequest(msg.from, `Mínimo Delay: ${min_delay}\nMáximo Delay: ${max_delay}\nContatos da Lista: ${subListaContatos.length}\n\nSegue o topo da sublista de contatos, preparando o disparo: \n\n${subListaContatos.slice(0, 5)}`, "text");
        await delay(1000); // Delay de 1 segundo

        const enviarProximaMensagem = async (index) => {
            if (index < subListaContatos.length) {
                const contato = subListaContatos[index];
                // Inserir aqui rotina de disparo do gatilho de V2 para o contato
                dispararFluxoV2ParaContato(contato, fluxo);
                const delayAleatorio = Math.floor(Math.random() * (max_delay - min_delay + 1)) + min_delay;
                await sendRequest(msg.from, `Disparo ${index + 1}/${subListaContatos.length}: Enviei o bloco de remarketing ao número: ${contato} e com delay de ${delayAleatorio}`, "text");

                setTimeout(() => enviarProximaMensagem(index + 1), delayAleatorio);
            }
        };

        enviarProximaMensagem(0);
    } catch (error) {
        await sendRequest(msg.from, `Erro: ${error.message}`, "text");
    }
}

});

function extrairNomeArquivo(str, posicao) {
  const partes = str.split(' ');
  if (posicao >= 0 && posicao < partes.length) {
    return partes[posicao];
  }
  return null;
}

async function extrairGrupo(grupoId) {
  const chat = await client.getChatById(grupoId);
  const contatos = [];

  chat.participants.forEach(participant => {
    if (!participant.isMe) {
      contatos.push(participant.id._serialized);
    }
  });

  return contatos;
}

async function dispararFluxoV2ParaContato(contato, nomeFluxo) {
  // Obter configurações do fluxo do banco de dados V2
  const typebotConfigsV2 = readJSONFileTypebotV2(DATABASE_FILE_TYPEBOT_V2);
  const configFluxo = typebotConfigsV2[nomeFluxo];

  if (!configFluxo) {
    console.log(`Fluxo ${nomeFluxo} não encontrado no banco de dados V2.`);
    return;
  }

  // Enviar o gatilho como mensagem para o contato
  try {
    await sendRequest(contato, configFluxo.gatilho,"text");
    console.log(`Mensagem de gatilho '${configFluxo.gatilho}' enviada para ${contato}.`);
  } catch (error) {
    console.error(`Erro ao enviar mensagem de gatilho para ${contato}:`, error);
  }
}

client.on('vote_update', async (vote) => {
  const sessionId = readSessionId(vote.voter);
  const content = vote.selectedOptions.map(option => option.name).join(", "); // Junta as opções em uma string
  //await client.sendMessage(vote.voter, 'Você escolheu a opção: ' + content + '... aguarde!');  
  const chaturl = `${readURL(0).url_chat}${sessionId}/continueChat`;
        
  const reqData = { message: content };

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: chaturl,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    data: JSON.stringify(reqData),
  };

  try {
    const response = await axios.request(config);
    const messages = response.data.messages;
 
  for (const message of messages){
    if (message.type === 'text') {
      let formattedText = '';
      for (const richText of message.content.richText) {
        for (const element of richText.children) {
          let text = '';
  
          if (element.text) {
            text = element.text;
          } else if (element.type === 'inline-variable') {              
            text = element.children[0].children[0].text;
          }
  
          if (element.bold) {
            text = `*${text}*`;
          }
          if (element.italic) {
            text = `_${text}_`;
          }
          if (element.underline) {
            text = `~${text}~`;
          }
  
          formattedText += text;
        }
        formattedText += '\n';
      }
  
      formattedText = formattedText.replace(/\n$/, '');
      if (formattedText.startsWith('!wait')) {
        await waitWithDelay(formattedText);
      }
      if (formattedText.startsWith('!fim')) {
        if (existsDB(vote.voter)) {
          updateFlow(vote.voter, "inactive");
        }
      }
      if (formattedText.startsWith('!optout')) {
        if (existsDB(vote.voter)) {
          updateOptout(vote.voter, true);
          removeFromDBTypebotV4(vote.voter);
        }
      }
      if (formattedText.startsWith('!reiniciar')) {
        if (existsDB(vote.voter)) {
          deleteObject(vote.voter);
        }
      }
      if (formattedText.startsWith('!entenderaudio')) {          
        if (existsDB(vote.voter)) {
          updateNextAudio(vote.voter, true);
        }
      }
      if (formattedText.startsWith('!entenderimagem')) {          
        if (existsDB(vote.voter)) {
          updateNextImage(vote.voter, true);
          updatePrompt(vote.voter, formattedText.split(' ').slice(1).join(' '));
        }
      }
      if (formattedText.startsWith('!audioopenai')) {          
        if (existsDB(vote.voter)) {
    
            try {
                // Sintetizar a fala
                await brokerMaster(sintetizarFalaOpenAI, formattedText.split(' ').slice(2).join(' '), vote.voter.split('@c.us')[0], formattedText.split(' ')[1]);
    
                // Caminho do arquivo de áudio gerado
                const mediaPath = `audiosintetizado/${vote.voter.split('@c.us')[0]}.ogg`;
    
                // Aqui você insere a lógica para tratar a mídia, se necessário
                const media = await tratarMidia(mediaPath);
    
                let retries = 0;
                const maxRetries = 15; // Máximo de tentativas
                let delay = init_delay; // Tempo inicial de espera em milissegundos
    
                const sendRequest = async () => {
                    const response = await fetch('http://localhost:3000/sendMessage', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            destinatario: vote.voter,
                            media: media,
                            tipo: "audio",                    
                            msg: vote
                        })
                    });
    
                    if (!response.ok) {
                        throw new Error(`Request failed with status ${response.status}`);
                    }
    
                    return await response.json();
                };
    
                while (retries < maxRetries) {
                    try {
                        await sendRequest();
                        restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                        break; // Sai do loop se a requisição for bem-sucedida
                    } catch (error) {
                        retries++;
                        console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                        if (!restartAPI) {
                            myEmitter.emit('errorEvent', error);
                            restartAPI = true;
                        }
                        await new Promise(resolve => setTimeout(resolve, delay));
                        delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
                    }
                }
    
                if (retries === maxRetries) {
                    console.error('Erro: Número máximo de tentativas de envio atingido.');
                }
    
            } catch (error) {
                console.error('Erro ao sintetizar fala:', error);
            }
        }
      }
      if (formattedText.startsWith('!audioeleven')) {
          if (existsDB(vote.voter)) {
      
              try {
                  // Extrai o nome da voz e o texto a ser sintetizado do comando
                  // Sintetizar a fala usando ElevenLabs
                  await brokerMaster(sintetizarFalaEleven, formattedText.split(' ').slice(2).join(' '), vote.voter.split('@c.us')[0], formattedText.split(' ')[1]);
      
                  // Caminho do arquivo de áudio gerado
                  const mediaPath = `audiosintetizado/${vote.voter.split('@c.us')[0]}.ogg`;
      
                  // Aqui você insere a lógica para tratar a mídia, se necessário
                  const media = await tratarMidia(mediaPath);
      
                  let retries = 0;
                  const maxRetries = 15; // Máximo de tentativas
                  let delay = init_delay; // Tempo inicial de espera em milissegundos
      
                  const sendRequest = async () => {
                      const response = await fetch('http://localhost:3000/sendMessage', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                              destinatario: vote.voter,
                              media: media,
                              tipo: "audio",                    
                              msg: ""
                          })
                      }); 
      
                      if (!response.ok) {
                          throw new Error(`Request failed with status ${response.status}`);
                      }
      
                      return await response.json();
                  };
      
                  while (retries < maxRetries) {
                      try {
                          await sendRequest();
                          restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                          break; // Sai do loop se a requisição for bem-sucedida
                      } catch (error) {
                          retries++;
                          console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                          if (!restartAPI) {
                              myEmitter.emit('errorEvent', error);
                              restartAPI = true;
                          }
                          await new Promise(resolve => setTimeout(resolve, delay));
                          delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
                      }
                  }
      
                  if (retries === maxRetries) {
                      console.error('Erro: Número máximo de tentativas de envio atingido.');
                  }
      
              } catch (error) {
                  console.error('Erro ao sintetizar fala com ElevenLabs:', error);
              }
          }
      }
      if (formattedText.startsWith('!imagemopenai')) {
        
        await runDallE(formattedText.split(' ').slice(1).join(' '), 'imagemliquida', vote.voter.split('@c.us')[0])
            .then(async (filePath) => {
               while (true) {
                try {
                    if (fs.existsSync(filePath)) {
                        await Jimp.read(filePath); // Tenta ler a imagem
                        break; // Se a imagem for lida sem erros, saia do loop
                    }
                } catch (error) {
                    console.log("A imagem ainda está sendo renderizada...");
                }
                await new Promise(resolve => setTimeout(resolve, 1000)); // Aguarda 1 segundo
            }
    
                let retries = 0;
                const maxRetries = 15; // Máximo de tentativas
                let delay = init_delay; // Tempo inicial de espera em milissegundos
    
                const sendRequest = async () => {
                    const media = await tratarMidia(filePath);
                    const response = await fetch('http://localhost:3000/sendMessage', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            destinatario: vote.voter,
                            media: media,
                            tipo: "image",
                            msg: "" // Mensagem opcional
                        })
                    });
    
                    if (!response.ok) {
                        throw new Error(`Request failed with status ${response.status}`);
                    }
    
                    return await response.json();
                };
    
                while (retries < maxRetries) {
                  try {
                      await sendRequest();
                      restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                      break; // Sai do loop se a requisição for bem-sucedida
                  } catch (error) {
                      retries++;
                      console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                      if (!restartAPI) {
                          myEmitter.emit('errorEvent', error);
                          restartAPI = true;
                      }
                      await new Promise(resolve => setTimeout(resolve, delay));
                      delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
                  }
              }
    
                if (retries === maxRetries) {
                    console.error('Erro: Número máximo de tentativas de envio atingido.');
                } else {
                    // Apagar a imagem após o envio bem-sucedido
                    fs.unlink(filePath, (err) => {
                        if (err) console.error('Erro ao apagar a imagem:', err);
                        else console.log(`Imagem ${filePath} apagada com sucesso.`);
                    });
                }
            })
            .catch((error) => console.error("Erro durante a geração da imagem:", error));
      }  
      if (!(formattedText.startsWith('!wait')) && !(formattedText.startsWith('!fim')) && !(formattedText.startsWith('!optout')) && !(formattedText.startsWith('!reiniciar')) && !(formattedText.startsWith('!entenderaudio')) && !(formattedText.startsWith('!entenderimagem')) && !(formattedText.startsWith('!audioopenai')) && !(formattedText.startsWith('!audioeleven'))  && !(formattedText.startsWith('!imagemopenai'))) {
        let retries = 0;
        const maxRetries = 15; // Máximo de tentativas
        let delay = init_delay; // Tempo inicial de espera em milissegundos                           
    
        const sendRequest = async () => {
            const response = await fetch('http://localhost:3000/sendMessage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    destinatario: vote.voter,
                    mensagem: formattedText,
                    tipo: "text",
                    msg: vote
                })
            });
    
            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }
    
            return await response.json();
        };
    
        while (retries < maxRetries) {
            try {
                await sendRequest();
                restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                break; // Sai do loop se a requisição for bem-sucedida
            } catch (error) {
                retries++;
                console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                if (!restartAPI) {
                    myEmitter.emit('errorEvent', error);
                    restartAPI = true;
                }
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
            }
        }
    
        if (retries === maxRetries) {
            console.error('Erro: Número máximo de tentativas de envio atingido.');
        }
    }                               
    }
    if (message.type === 'image') {
      let retries = 0;
      const maxRetries = 15; // Máximo de tentativas
      let delay = init_delay; // Tempo inicial de espera em milissegundos
      
  
      const sendRequest = async () => {
          const media = await tratarMidia(message);
          const response = await fetch('http://localhost:3000/sendMessage', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  destinatario: vote.voter,
                  media: media,
                  tipo: "image",
                  msg: vote
              })
          });
  
          if (!response.ok) {
              throw new Error(`Request failed with status ${response.status}`);
          }
  
          return await response.json();
      };
  
      while (retries < maxRetries) {
          try {
              await sendRequest();
              restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
              break; // Sai do loop se a requisição for bem-sucedida
          } catch (error) {
              retries++;
              console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
              if (!restartAPI) {
                  myEmitter.emit('errorEvent', error);
                  restartAPI = true;
              }
              await new Promise(resolve => setTimeout(resolve, delay));
              delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
          }
      }
  
      if (retries === maxRetries) {
          console.error('Erro: Número máximo de tentativas de envio atingido.');
      }
    }                          
    if (message.type === 'video') {
      let retries = 0;
      const maxRetries = 15; // Máximo de tentativas
      let delay = init_delay; // Tempo inicial de espera em milissegundos
      
  
      const sendRequest = async () => {
          const media = await tratarMidia(message);
          const response = await fetch('http://localhost:3000/sendMessage', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  destinatario: vote.voter,
                  media: media,
                  tipo: "video",
                  msg: vote
              })
          });
  
          if (!response.ok) {
              throw new Error(`Request failed with status ${response.status}`);
          }
  
          return await response.json();
      };
  
      while (retries < maxRetries) {
          try {
              await sendRequest();
              restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
              break; // Sai do loop se a requisição for bem-sucedida
          } catch (error) {
              retries++;
              console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
              if (!restartAPI) {
                  myEmitter.emit('errorEvent', error);
                  restartAPI = true;
              }
              await new Promise(resolve => setTimeout(resolve, delay));
              delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
          }
      }
  
      if (retries === maxRetries) {
          console.error('Erro: Número máximo de tentativas de envio atingido.');
      }
    }                            
    if (message.type === 'audio') {
      let retries = 0;
      const maxRetries = 15; // Máximo de tentativas
      let delay = init_delay; // Tempo inicial de espera em milissegundos
      
  
      const sendRequest = async () => {
          const media = await tratarMidia(message);
          const response = await fetch('http://localhost:3000/sendMessage', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  destinatario: vote.voter,
                  media: media,
                  tipo: "audio",                    
                  msg: vote
              })
          });
  
          if (!response.ok) {
              throw new Error(`Request failed with status ${response.status}`);
          }
  
          return await response.json();
      };
  
      while (retries < maxRetries) {
          try {
              await sendRequest();
              restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
              break; // Sai do loop se a requisição for bem-sucedida
          } catch (error) {
              retries++;
              console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
              if (!restartAPI) {
                  myEmitter.emit('errorEvent', error);
                  restartAPI = true;
              }
              await new Promise(resolve => setTimeout(resolve, delay));
              delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
          }
      }
  
      if (retries === maxRetries) {
          console.error('Erro: Número máximo de tentativas de envio atingido.');
      }
    }                           
  }
  const input = response.data.input
  if (input) {
      if (input.type === 'choice input') {
        let formattedText = '';
        const items = input.items;
        let arrayoptions = [];
        for (const item of items) {
          formattedText += `▶️ ${item.content}\n`;
          arrayoptions.push(item.content);
        }
        //console.log(arrayoptions)          
          await client.sendMessage(vote.voter, new Poll('Escolha uma opção:', arrayoptions));
        }
  }
  //console.log(vote)
  const msgToEdit = vote.parentMessage
  msgToEdit.body.replace('*Escolha uma resposta:*', 'Resposta armazenada');
  await msgToEdit.delete(true);
  }
  catch (error) {
    console.error('Erro ao enviar requisição:', error);
  }
});

// Parei aqui na imprementação do poll