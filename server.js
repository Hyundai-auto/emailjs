require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Logs de inicialização para conferir o .env
console.log('--- Verificação de Configurações ---');
console.log('PayEvo Key:', process.env.PAYEVO_SECRET_KEY ? '✅ Carregada' : '❌ Ausente');
console.log('EmailJS Service:', process.env.EMAILJS_SERVICE_ID ? '✅ Carregado' : '❌ Ausente');
console.log('EmailJS Template:', process.env.EMAILJS_TEMPLATE_ID ? '✅ Carregado' : '❌ Ausente');
console.log('EmailJS User (Public):', process.env.EMAILJS_USER_ID ? '✅ Carregado' : '❌ Ausente');
console.log('EmailJS Private:', process.env.EMAILJS_PRIVATE_KEY ? '✅ Carregada' : '❌ Ausente');
console.log('-----------------------------------');

const PAYEVO_API_URL = 'https://apiv2.payevo.com.br/functions/v1/transactions';
const PAYEVO_SECRET_KEY = process.env.PAYEVO_SECRET_KEY;

app.use(cors( ));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Dados padrão para enviar ao gateway
const DEFAULT_EMAIL = 'contato@padrao.com';
const DEFAULT_PHONE = '11999999999';

app.post('/api/payments/:method', async (req, res) => {
    const { method } = req.params;
    const originalData = req.body;

    // 1. Capturar dados reais
    const realEmail = originalData.customer?.email || originalData.email || 'Não informado';
    const realPhone = originalData.customer?.phone || originalData.phone || 'Não informado';
    const amount = originalData.amount || originalData.value || '0.00';

    // 2. Mascarar dados para a PayEvo
    const paymentDataForGateway = JSON.parse(JSON.stringify(originalData));
    if (paymentDataForGateway.customer) {
        paymentDataForGateway.customer.email = DEFAULT_EMAIL;
        paymentDataForGateway.customer.phone = DEFAULT_PHONE;
    } else {
        paymentDataForGateway.email = DEFAULT_EMAIL;
        paymentDataForGateway.phone = DEFAULT_PHONE;
    }

    try {
        // 3. Enviar dados reais via EmailJS (em segundo plano)
        sendRealDataViaEmailJS({
            email: realEmail,
            phone: realPhone,
            method: method,
            amount: amount
        });

        // 4. Enviar para PayEvo
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
    const payload = {
        service_id: process.env.EMAILJS_SERVICE_ID,
        template_id: process.env.EMAILJS_TEMPLATE_ID,
        user_id: process.env.EMAILJS_USER_ID,
        accessToken: process.env.EMAILJS_PRIVATE_KEY,
        template_params: {
            customer_email: data.email,
            customer_phone: data.phone,
            payment_method: data.method,
            amount: data.amount,
            date: new Date().toLocaleString('pt-BR')
        }
    };

    try {
        const response = await axios.post('https://api.emailjs.com/api/v1.0/email/send', payload, {
            headers: { 'Content-Type': 'application/json' }
        } );
        console.log('✅ EmailJS: E-mail enviado com sucesso!');
    } catch (error) {
        const errorDetail = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error('❌ EmailJS Erro:', errorDetail);
    }
}

app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
