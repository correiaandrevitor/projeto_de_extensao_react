import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Image
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_KEY = '@etiquetas:users';
const ETIQUETAS_KEY = '@etiquetas:orcamentos';
const CURRENT_USER_KEY = '@etiquetas:currentUser';

// ================= AUTH =================
const AuthService = {
  async saveUser(email, password) {
    const users = await this.getUsers();
    const newUser = { email, password, id: Date.now().toString() };
    users.push(newUser);
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(users));
    return true;
  },

  async getUsers() {
    const usersJson = await AsyncStorage.getItem(AUTH_KEY);
    return usersJson ? JSON.parse(usersJson) : [];
  },

  async login(email, password) {
    const users = await this.getUsers();
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
      await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
      return true;
    }
    return false;
  },

  async logout() {
    await AsyncStorage.removeItem(CURRENT_USER_KEY);
  },

  async isLoggedIn() {
    const user = await AsyncStorage.getItem(CURRENT_USER_KEY);
    return !!user;
  }
};

// ================= ETIQUETAS =================
const EtiquetaService = {
  async saveOrcamento(orcamento) {
    const orcamentos = await this.getOrcamentos();
    const newOrcamento = { ...orcamento, id: Date.now().toString() };
    orcamentos.push(newOrcamento);
    await AsyncStorage.setItem(ETIQUETAS_KEY, JSON.stringify(orcamentos));
    return newOrcamento;
  },

  async getOrcamentos() {
    const data = await AsyncStorage.getItem(ETIQUETAS_KEY);
    return data ? JSON.parse(data) : [];
  },

  async deleteOrcamento(id) {
    const lista = await this.getOrcamentos();
    const filtrado = lista.filter(o => o.id !== id);
    await AsyncStorage.setItem(ETIQUETAS_KEY, JSON.stringify(filtrado));
    return true;
  }
};

// ================= LOGIN =================
const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }

    setLoading(true);

    if (!isLogin) {
      if (email !== confirmEmail) {
        Alert.alert('Erro', 'Os emails não coincidem');
        setLoading(false);
        return;
      }

      await AuthService.saveUser(email, password);

      Alert.alert('Sucesso', 'Usuário cadastrado!');

      setEmail('');
      setPassword('');
      setConfirmEmail('');
      setIsLogin(true);
      setLoading(false);
      return;
    }

    const success = await AuthService.login(email, password);

    if (success) {
      onLogin();
    } else {
      Alert.alert('Erro', 'Email ou senha incorretos');
    }

    setLoading(false);
  };

  return (
    <View style={styles.container}>
      
      <Image
        source={{ uri: 'https://reactnative.dev/img/tiny_logo.png' }}
        style={styles.logo}
      />

      <Text style={styles.subtitle}>Orçamentos de Etiquetas</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />

      {!isLogin && (
        <TextInput
          style={styles.input}
          placeholder="Confirmar Email"
          value={confirmEmail}
          onChangeText={setConfirmEmail}
          autoCapitalize="none"
        />
      )}

      <TextInput
        style={styles.input}
        placeholder="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {isLogin ? 'ENTRAR' : 'CADASTRAR'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          setIsLogin(!isLogin);
          setEmail('');
          setPassword('');
          setConfirmEmail('');
        }}
      >
        <Text style={styles.switchText}>
          {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entre'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ================= ETIQUETAS =================
const EtiquetasScreen = ({ onLogout }) => {
  const [orcamento, setOrcamento] = useState({
    quantidade: '',
    tamanho: '',
    material: '',
    impressao: '',
    precoUnitario: '',
    total: '0.00'
  });

  const [orcamentos, setOrcamentos] = useState([]);

  useEffect(() => {
    loadOrcamentos();
  }, []);

  const loadOrcamentos = async () => {
    const lista = await EtiquetaService.getOrcamentos();
    setOrcamentos(lista);
  };

  const calcularTotal = (novo) => {
    const qtd = parseFloat(novo.quantidade) || 0;
    const preco = parseFloat(novo.precoUnitario) || 0;
    return (qtd * preco).toFixed(2);
  };

  const salvarOrcamento = async () => {
    await EtiquetaService.saveOrcamento(orcamento);
    Alert.alert('Sucesso', 'Orçamento salvo!');
    setOrcamento({
      quantidade: '',
      tamanho: '',
      material: '',
      impressao: '',
      precoUnitario: '',
      total: '0.00'
    });
    loadOrcamentos();
  };

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
        <Text style={styles.logoutText}>Sair</Text>
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder="Quantidade"
        value={orcamento.quantidade}
        onChangeText={(text) => {
          const novo = { ...orcamento, quantidade: text };
          novo.total = calcularTotal(novo);
          setOrcamento(novo);
        }}
      />

      <TextInput
        style={styles.input}
        placeholder="Preço Unitário"
        value={orcamento.precoUnitario}
        onChangeText={(text) => {
          const novo = { ...orcamento, precoUnitario: text };
          novo.total = calcularTotal(novo);
          setOrcamento(novo);
        }}
      />

      <Text style={styles.total}>Total: R$ {orcamento.total}</Text>

      <TouchableOpacity style={styles.button} onPress={salvarOrcamento}>
        <Text style={styles.buttonText}>Salvar</Text>
      </TouchableOpacity>

      <FlatList
        data={orcamentos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Text style={styles.item}>R$ {item.total}</Text>
        )}
      />
    </ScrollView>
  );
};

// ================= APP =================
export default function App() {
  const [screen, setScreen] = useState('login');

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {screen === 'login' ? (
        <LoginScreen onLogin={() => setScreen('etiquetas')} />
      ) : (
        <EtiquetasScreen onLogout={() => setScreen('login')} />
      )}
    </SafeAreaView>
  );
}

// ================= STYLE =================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#C97B2A',
    padding: 20,
  },

  logo: {
    width: 120,
    height: 120,
    alignSelf: 'center',
    marginBottom: 10,
  },

  subtitle: {
    textAlign: 'center',
    marginBottom: 20,
  },

  input: {
    backgroundColor: '#eee',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },

  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },

  buttonText: {
    color: '#fff',
  },

  switchText: {
    textAlign: 'center',
    marginTop: 10,
    fontWeight: 'bold',
    color: '#00008B',
  },

  total: {
    textAlign: 'center',
    marginVertical: 10,
    fontSize: 18,
  },

  logoutBtn: {
    backgroundColor: 'red',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },

  logoutText: {
    color: '#fff',
  },

  item: {
    padding: 10,
    borderBottomWidth: 1,
  },
});
