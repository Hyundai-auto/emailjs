require('dotenv').config(); // Esta linha lê o arquivo .env
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// O código agora busca a chave automaticamente do arquivo .env
const PAYEVO_API_URL = 'https://apiv2.payevo.com.br/functions/v1/transactions';
const PAYEVO_SECRET_KEY = process.env.PAYEVO_SECRET_KEY;

app.use(cors( ));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configurações padrão para o gateway
const DEFAULT_EMAIL = 'contato@padrao.com';
const DEFAULT_PHONE = '11999999999';

app.post('/api/payments/:method', async (req, res) => {
    const { method } = req.params;
    const originalData = req.body;

    // 1. Extrair dados reais para enviar via EmailJS depois
    const realEmail = originalData.customer?.email || originalData.email;
    const realPhone = originalData.customer?.phone || originalData.phone;

    // 2. Criar cópia dos dados e substituir pelos valores padrão para o gateway
    const paymentDataForGateway = JSON.parse(JSON.stringify(originalData));
    
    if (paymentDataForGateway.customer) {
        paymentDataForGateway.customer.email = DEFAULT_EMAIL;
        paymentDataForGateway.customer.phone = DEFAULT_PHONE;
    } else {
        paymentDataForGateway.email = DEFAULT_EMAIL;
        paymentDataForGateway.phone = DEFAULT_PHONE;
    }

    try {
        // 3. Enviar dados reais via EmailJS (implementaremos a função abaixo)
        await sendRealDataViaEmailJS({
            email: realEmail,
            phone: realPhone,
            method: method,
            amount: originalData.amount || originalData.value
        });

        // 4. Enviar dados mascarados para a PayEvo
        const authHeader = `Basic ${Buffer.from(PAYEVO_SECRET_KEY + ':').toString('base64')}`;
        const response = await axios.post(PAYEVO_API_URL, paymentDataForGateway, {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error('Erro no processamento:', error.message);
        res.status(error.response ? error.response.status : 500).json(
            error.response ? error.response.data : { message: 'Erro interno no servidor' }
        );
    }
});

async function sendRealDataViaEmailJS(data) {
    const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
    const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;
    const EMAILJS_USER_ID = process.env.EMAILJS_USER_ID;
    const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;

    if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_USER_ID) {
        console.warn('Configurações do EmailJS ausentes. Pulando envio de dados reais.');
        return;
    }

    try {
        await axios.post('https://api.emailjs.com/api/v1.0/email/send', {
            service_id: EMAILJS_SERVICE_ID,
            template_id: EMAILJS_TEMPLATE_ID,
            user_id: EMAILJS_USER_ID,
            accessToken: EMAILJS_PRIVATE_KEY,
            template_params: {
                customer_email: data.email,
                customer_phone: data.phone,
                payment_method: data.method,
                amount: data.amount,
                date: new Date().toLocaleString('pt-BR')
            }
        });
        console.log('Dados reais enviados com sucesso via EmailJS');
    } catch (error) {
        console.error('Erro ao enviar para EmailJS:', error.response?.data || error.message);
    }
}

app.listen(PORT, () => console.log(`Rodando na porta ${PORT}`));
