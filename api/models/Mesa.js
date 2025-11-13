import mongoose from 'mongoose';

const mesaSchema = new mongoose.Schema({
  numero: {
    type: String,
    required: true,
    unique: true
  },
  nome: {
    type: String,
    required: true
  },
  capacidade: {
    type: Number,
    required: true,
    min: 1
  },
  status: {
    type: String,
    enum: ['livre', 'ocupada', 'reservada', 'manutencao'],
    default: 'livre'
  },
  vendaAtual: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
    default: null
  },
  funcionarioResponsavel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  },
  nomeResponsavel: {
    type: String,
    maxlength: 100
  },
  clientesAtuais: {
    type: Number,
    default: 0
  },
  horaAbertura: {
    type: Date
  },
  observacoes: {
    type: String,
    maxlength: 200
  },
  tipo: {
    type: String,
    enum: ['interna', 'externa', 'vip', 'reservada', 'balcao'],
    default: 'interna'
  },
  ativo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Método para abrir mesa
mesaSchema.methods.abrir = function(numeroClientes = 1) {
  this.status = 'ocupada';
  this.clientesAtuais = numeroClientes;
  this.horaAbertura = new Date();
  return this.save();
};

// Método para fechar mesa
mesaSchema.methods.fechar = function() {
  this.status = 'livre';
  this.vendaAtual = null;
  this.funcionarioResponsavel = null;
  this.nomeResponsavel = '';
  this.clientesAtuais = 0;
  this.horaAbertura = null;
  this.observacoes = '';
  return this.save();
};

// Método para calcular tempo de ocupação
mesaSchema.methods.tempoOcupacao = function() {
  if (!this.horaAbertura) return 0;
  return Math.floor((new Date() - this.horaAbertura) / (1000 * 60)); // em minutos
};

export default mongoose.model('Mesa', mesaSchema);