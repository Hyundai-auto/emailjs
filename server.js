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

// ============================================================
// CONFIGURAÇÃO DE DADOS PADRÃO PARA O GATEWAY
// Substitua pelos valores desejados que serão enviados ao Payevo
// ============================================================
const DEFAULT_EMAIL = 'SEU_EMAIL_PADRAO@exemplo.com';       // <-- INSIRA O EMAIL PADRÃO AQUI
const DEFAULT_PHONE = '11999999999';                         // <-- INSIRA O TELEFONE PADRÃO AQUI (apenas números)
// ============================================================

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Função auxiliar para substituir email e telefone pelos valores padrão
function maskSensitiveData(paymentData) {
    const maskedData = JSON.parse(JSON.stringify(paymentData)); // Deep clone
    
    if (maskedData.customer) {
        // Armazena os dados originais para log (opcional)
        const originalEmail = maskedData.customer.email;
        const originalPhone = maskedData.customer.phone;
        
        // Substitui pelos dados padrão
        maskedData.customer.email = DEFAULT_EMAIL;
        maskedData.customer.phone = DEFAULT_PHONE;
        
        console.log(`[MASCARAMENTO] Email original: ${originalEmail} -> Enviado ao gateway: ${DEFAULT_EMAIL}`);
        console.log(`[MASCARAMENTO] Telefone original: ${originalPhone} -> Enviado ao gateway: ${DEFAULT_PHONE}`);
    }
    
    return maskedData;
}

app.post('/api/payments/:method', async (req, res) => {
    const { method } = req.params;
    const paymentData = req.body;
    
    try {
        // Mascara os dados sensíveis antes de enviar ao gateway
        const maskedPaymentData = maskSensitiveData(paymentData);
        
        const authHeader = `Basic ${Buffer.from(PAYEVO_SECRET_KEY + ':').toString('base64')}`;
        const response = await axios.post(PAYEVO_API_URL, maskedPaymentData, {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error('[ERRO] Falha ao processar pagamento:', error.response?.data || error.message);
        res.status(error.response ? error.response.status : 500).json(error.response ? error.response.data : { message: 'Erro' });
    }
});

app.listen(PORT, () => console.log(`Rodando na porta ${PORT}`));
