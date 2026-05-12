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
import CryptoJS from 'crypto-js';

// ================= DATABASE (AsyncStorage) =================
// Simulates relational tables using AsyncStorage key-value pairs.
// Structure:
//   @db:users        → { [email]: { id, email, password_hash, created_at } }
//   @db:orcamentos   → { [id]: { id, user_id, quantidade, ... } }
//   @db:admin        → { email, password_hash } (admin credentials)

const DB = {
  async getTable(name) {
    const raw = await AsyncStorage.getItem(`@db:${name}`);
    return raw ? JSON.parse(raw) : {};
  },

  async setTable(name, data) {
    await AsyncStorage.setItem(`@db:${name}`, JSON.stringify(data));
  },
};

const initDB = async () => {
  // Ensure tables exist
  const users = await DB.getTable('users');
  const orcamentos = await DB.getTable('orcamentos');
  const admin = await DB.getTable('admin');
  
  if (!users) await DB.setTable('users', {});
  if (!orcamentos) await DB.setTable('orcamentos', {});
  
  // Create default admin if doesn't exist
  if (!admin.email) {
    const salt = CryptoService.generateSalt();
    const passwordHash = CryptoService.hashPassword('admin123', salt);
    await DB.setTable('admin', {
      email: 'admin@app.com',
      password_hash: passwordHash,
      created_at: new Date().toISOString()
    });
    console.log('✅ Admin criado: admin@app.com / admin123');
  }
};

// ================= CRYPTO (crypto-js) =================
const CryptoService = {
  generateSalt() {
    const words = CryptoJS.lib.WordArray.random(16);
    return `$salt$${words.toString(CryptoJS.enc.Hex)}`;
  },

  hashPassword(password, salt) {
    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: 256 / 32,
      iterations: 10000,
      hasher: CryptoJS.algo.SHA256,
    });
    return `${salt}:${key.toString(CryptoJS.enc.Hex)}`;
  },

  verifyPassword(password, storedHash) {
    const colonIdx = storedHash.indexOf(':');
    const salt = storedHash.substring(0, colonIdx);
    const newHash = this.hashPassword(password, salt);
    return newHash === storedHash;
  },
};

// ================= AUTH SERVICE =================
const AuthService = {
  currentUser: null,
  currentAdmin: null,

  async register(email, password) {
    try {
      const users = await DB.getTable('users');
      const key = email.toLowerCase().trim();

      if (users[key]) {
        return { success: false, error: 'Email já cadastrado' };
      }

      const salt = CryptoService.generateSalt();
      const passwordHash = CryptoService.hashPassword(password, salt);

      users[key] = {
        id: Date.now().toString(),
        email: key,
        password_hash: passwordHash,
        created_at: new Date().toISOString(),
      };

      await DB.setTable('users', users);
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Erro ao cadastrar usuário' };
    }
  },

  async login(email, password) {
    try {
      const users = await DB.getTable('users');
      const key = email.toLowerCase().trim();
      const user = users[key];

      if (!user) {
        return { success: false, error: 'Email ou senha incorretos' };
      }

      const isValid = CryptoService.verifyPassword(password, user.password_hash);

      if (!isValid) {
        return { success: false, error: 'Email ou senha incorretos' };
      }

      this.currentUser = { id: user.id, email: user.email };
      return { success: true, user: this.currentUser };
    } catch (error) {
      return { success: false, error: 'Erro ao fazer login' };
    }
  },

  async adminLogin(email, password) {
    try {
      const admin = await DB.getTable('admin');
      
      if (admin.email !== email.toLowerCase().trim()) {
        return { success: false, error: 'Email de admin incorreto' };
      }

      const isValid = CryptoService.verifyPassword(password, admin.password_hash);

      if (!isValid) {
        return { success: false, error: 'Senha de admin incorreta' };
      }

      this.currentAdmin = { email: admin.email };
      return { success: true, admin: this.currentAdmin };
    } catch (error) {
      return { success: false, error: 'Erro no login de admin' };
    }
  },

  logout() {
    this.currentUser = null;
    this.currentAdmin = null;
  },
};

// ================= ADMIN SERVICE =================
const AdminService = {
  async getAllUsers() {
    try {
      const users = await DB.getTable('users');
      return Object.values(users).map(user => ({
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        orcamentosCount: 0 // será preenchido depois
      }));
    } catch (error) {
      return [];
    }
  },

  async getUserOrcamentosCount(userId) {
    try {
      const orcamentos = await DB.getTable('orcamentos');
      return Object.values(orcamentos).filter(o => o.user_id === userId).length;
    } catch (error) {
      return 0;
    }
  },

  async deleteUser(userId) {
    try {
      const users = await DB.getTable('users');
      const userEmail = Object.keys(users).find(email => users[email].id === userId);
      
      if (!userEmail) {
        return { success: false, error: 'Usuário não encontrado' };
      }

      // Delete user
      delete users[userEmail];
      await DB.setTable('users', users);

      // Delete all user orcamentos
      const orcamentos = await DB.getTable('orcamentos');
      Object.keys(orcamentos).forEach(id => {
        if (orcamentos[id].user_id === userId) {
          delete orcamentos[id];
        }
      });
      await DB.setTable('orcamentos', orcamentos);

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Erro ao excluir usuário' };
    }
  }
};

// ================= LOGIN SCREEN =================
const LoginScreen = ({ onLogin, onAdminLogin }) => {
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }

    if (password.length < 6 && !isAdminMode) {
      Alert.alert('Erro', 'A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);

    if (!isLogin) {
      if (email !== confirmEmail) {
        Alert.alert('Erro', 'Os emails não coincidem');
        setLoading(false);
        return;
      }

      const result = await AuthService.register(email, password);

      if (result.success) {
        Alert.alert('Sucesso', 'Usuário cadastrado com sucesso!');
        setEmail('');
        setPassword('');
        setConfirmEmail('');
        setIsLogin(true);
      } else {
        Alert.alert('Erro', result.error);
      }
      setLoading(false);
      return;
    }

    if (isAdminMode) {
      const result = await AuthService.adminLogin(email, password);
      if (result.success) {
        onAdminLogin(result.admin);
      } else {
        Alert.alert('Erro', result.error);
      }
    } else {
      const result = await AuthService.login(email, password);
      if (result.success) {
        onLogin(result.user);
      } else {
        Alert.alert('Erro', result.error);
      }
    }

    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: 'https://reactnative.dev/img/tiny_logo.png' }}
        style={styles.logo}
      />

      <Text style={styles.subtitle}>
        {isAdminMode ? 'Painel Admin' : 'Orçamentos de Etiquetas'}
      </Text>

      <TextInput
        style={styles.input}
        placeholder={isAdminMode ? "Email Admin" : "Email"}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete={isAdminMode ? "email" : "email"}
      />

      {!isLogin && !isAdminMode && (
        <TextInput
          style={styles.input}
          placeholder="Confirmar Email"
          value={confirmEmail}
          onChangeText={setConfirmEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      )}

      <View style={styles.passwordWrapper}>
        <TextInput
          style={styles.inputPassword}
          placeholder={isAdminMode ? "Senha Admin" : "Senha"}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoComplete={isAdminMode ? 'password' : isLogin ? 'password' : 'new-password'}
        />
        <TouchableOpacity
          style={styles.eyeBtn}
          onPress={() => setShowPassword(v => !v)}
        >
          <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {isAdminMode ? 'ENTRAR ADMIN' : (isLogin ? 'ENTRAR' : 'CADASTRAR')}
          </Text>
        )}
      </TouchableOpacity>

      {!isAdminMode && (
        <TouchableOpacity
          onPress={() => {
            setIsLogin(!isLogin);
            setEmail('');
            setPassword('');
            setConfirmEmail('');
            setShowPassword(false);
          }}
        >
          <Text style={styles.switchText}>
            {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entre'}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.adminToggleBtn}
        onPress={() => {
          setIsAdminMode(!isAdminMode);
          setEmail('');
          setPassword('');
          setConfirmEmail('');
          setShowPassword(false);
          setIsLogin(true);
        }}
      >
        <Text style={styles.adminToggleText}>
          {isAdminMode ? '👤 Usuário Normal' : '🔧 Login Admin'}
        </Text>
        {isAdminMode && (
          <Text style={styles.adminHint}>Padrão: admin@app.com / admin123</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

// ================= ADMIN PANEL SCREEN =================
const AdminPanelScreen = ({ admin, onLogout }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const userList = await AdminService.getAllUsers();
    
    // Add orcamentos count to each user
    for (let user of userList) {
      user.orcamentosCount = await AdminService.getUserOrcamentosCount(user.id);
    }
    
    setUsers(userList);
    setLoading(false);
  };

  const deleteUser = (userId) => {
    Alert.alert(
      '⚠️ ATENÇÃO',
      'Excluir este usuário apagará TODOS os seus orçamentos também!',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'EXCLUIR',
          style: 'destructive',
          onPress: async () => {
            setRefreshing(true);
            const result = await AdminService.deleteUser(userId);
            if (result.success) {
              Alert.alert('Sucesso', 'Usuário e orçamentos excluídos!');
              loadUsers();
            } else {
              Alert.alert('Erro', result.error);
            }
            setRefreshing(false);
          }
        }
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Carregando usuários...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.adminTitle}>🔧 Painel Administrador</Text>
          <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Total de Usuários: {users.length}</Text>

        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          refreshing={refreshing}
          onRefresh={onRefresh}
          renderItem={({ item }) => (
            <View style={styles.adminUserCard}>
              <View style={styles.adminUserInfo}>
                <Text style={styles.adminUserEmail}>{item.email}</Text>
                <Text style={styles.adminUserDate}>
                  Cadastrado: {new Date(item.created_at).toLocaleDateString('pt-BR')}
                </Text>
                <Text style={styles.adminUserOrcamentos}>
                  📋 Orçamentos: {item.orcamentosCount}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.deleteAdminBtn}
                onPress={() => deleteUser(item.id)}
                disabled={refreshing}
              >
                <Text style={styles.deleteAdminText}>🗑️ EXCLUIR</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Nenhum usuário cadastrado</Text>
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
};

// ================= ETIQUETAS SCREEN (mantida igual) =================
const EtiquetasScreen = ({ user, onLogout }) => {
  const [orcamento, setOrcamento] = useState({
    quantidade: '',
    tamanho: '',
    material: '',
    impressao: '',
    precoUnitario: '',
    total: '0.00'
  });

  const [orcamentos, setOrcamentos] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadOrcamentos();
  }, []);

  const loadOrcamentos = async () => {
    const lista = await OrcamentoService.getByUser(user.id);
    setOrcamentos(lista);
  };

  const calcularTotal = (novo) => {
    const qtd = parseFloat(novo.quantidade) || 0;
    const preco = parseFloat(novo.precoUnitario) || 0;
    return (qtd * preco).toFixed(2);
  };

  const salvarOrcamento = async () => {
    if (!orcamento.quantidade || !orcamento.precoUnitario) {
      Alert.alert('Atenção', 'Informe quantidade e preço unitário');
      return;
    }

    setLoading(true);
    const result = await OrcamentoService.save(user.id, orcamento);

    if (result.success) {
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
    } else {
      Alert.alert('Erro', result.error);
    }

    setLoading(false);
  };

  const deletarOrcamento = (id) => {
    Alert.alert(
      'Confirmar',
      'Deseja excluir este orçamento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await OrcamentoService.delete(id, user.id);
            loadOrcamentos();
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.userEmail}>{user.email}</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Novo Orçamento</Text>

      <TextInput
        style={styles.input}
        placeholder="Quantidade"
        value={orcamento.quantidade}
        onChangeText={(text) => {
          const novo = { ...orcamento, quantidade: text };
          novo.total = calcularTotal(novo);
          setOrcamento(novo);
        }}
        keyboardType="numeric"
      />

      <TextInput
        style={styles.input}
        placeholder="Tamanho (ex: 10x5cm)"
        value={orcamento.tamanho}
        onChangeText={(text) => setOrcamento({ ...orcamento, tamanho: text })}
      />

      <TextInput
        style={styles.input}
        placeholder="Material"
        value={orcamento.material}
        onChangeText={(text) => setOrcamento({ ...orcamento, material: text })}
      />

      <TextInput
        style={styles.input}
        placeholder="Impressão"
        value={orcamento.impressao}
        onChangeText={(text) => setOrcamento({ ...orcamento, impressao: text })}
      />

      <TextInput
        style={styles.input}
        placeholder="Preço Unitário (R$)"
        value={orcamento.precoUnitario}
        onChangeText={(text) => {
          const novo = { ...orcamento, precoUnitario: text };
          novo.total = calcularTotal(novo);
          setOrcamento(novo);
        }}
        keyboardType="numeric"
      />

      <Text style={styles.total}>Total: R$ {orcamento.total}</Text>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={salvarOrcamento}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>SALVAR ORÇAMENTO</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Orçamentos Salvos</Text>

      {orcamentos.length === 0 ? (
        <Text style={styles.emptyText}>Nenhum orçamento salvo</Text>
      ) : (
        orcamentos.map((item) => (
          <View key={item.id} style={styles.itemCard}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemTotal}>R$ {Number(item.total).toFixed(2)}</Text>
              <Text style={styles.itemDetail}>Qtd: {item.quantidade} × R$ {Number(item.preco_unitario).toFixed(2)}</Text>
              {item.tamanho ? <Text style={styles.itemDetail}>Tamanho: {item.tamanho}</Text> : null}
              {item.material ? <Text style={styles.itemDetail}>Material: {item.material}</Text> : null}
              {item.impressao ? <Text style={styles.itemDetail}>Impressão: {item.impressao}</Text> : null}
              <Text style={styles.itemDate}>{new Date(item.created_at).toLocaleDateString('pt-BR')}</Text>
            </View>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => deletarOrcamento(item.id)}
            >
              <Text style={styles.deleteText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
};

// ================= APP =================
export default function App() {
  const [screen, setScreen] = useState('loading');
  const [currentUser, setCurrentUser] = useState(null);
  const [currentAdmin, setCurrentAdmin] = useState(null);

  useEffect(() => {
    const setup = async () => {
      try {
        await initDB();
        setScreen('login');
      } catch (error) {
        Alert.alert('Erro', 'Falha ao inicializar banco de dados');
        console.error('DB init error:', error);
      }
    };
    setup();
  }, []);

  if (screen === 'loading') {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Iniciando...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {screen === 'login' ? (
        <LoginScreen
          onLogin={(user) => {
            setCurrentUser(user);
            setCurrentAdmin(null);
            setScreen('etiquetas');
          }}
          onAdminLogin={(admin) => {
            setCurrentAdmin(admin);
            setCurrentUser(null);
            setScreen('admin');
          }}
        />
      ) : screen === 'admin' ? (
        <AdminPanelScreen
          admin={currentAdmin}
          onLogout={() => {
            AuthService.logout();
            setCurrentAdmin(null);
            setCurrentUser(null);
            setScreen('login');
          }}
        />
      ) : (
        <EtiquetasScreen
          user={currentUser}
          onLogout={() => {
            AuthService.logout();
            setCurrentUser(null);
            setCurrentAdmin(null);
            setScreen('login');
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ================= STYLES (adicionados estilos para admin) =================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#C97B2A',
    padding: 20,
  },

  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },

  adminTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    flex: 1,
  },

  input: {
    backgroundColor: '#eee',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    fontSize: 16,
  },

  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },

  switchText: {
    textAlign: 'center',
    marginTop: 10,
    fontWeight: 'bold',
    color: '#00008B',
  },

  adminToggleBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },

  adminToggleText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },

  adminHint: {
    color: '#FFD700',
    fontSize: 12,
    marginTop: 5,
    fontStyle: 'italic',
  },

  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eee',
    borderRadius: 10,
    marginBottom: 10,
  },

  inputPassword: {
    flex: 1,
    padding: 15,
    fontSize: 16,
  },

  eyeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  eyeIcon: {
    fontSize: 20,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },

  userEmail: {
    color: '#fff',
    fontSize: 13,
    flex: 1,
    marginRight: 10,
  },

  logoutBtn: {
    backgroundColor: 'red',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },

  logoutText: {
    color: '#fff',
    fontWeight: 'bold',
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginVertical: 10,
  },

  total: {
    textAlign: 'center',
    marginVertical: 10,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },

  emptyText: {
    textAlign: 'center',
    color: '#fff',
    opacity: 0.7,
    marginTop: 20,
    fontSize: 16,
  },

  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },

  itemInfo: {
    flex: 1,
  },

  itemTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#C97B2A',
  },

  itemDetail: {
    fontSize: 13,
    color: '#555',
    marginTop: 2,
  },

  itemDate: {
    fontSize: 11,
    color: '#999',
    marginTop: 5,
  },

  deleteBtn: {
    backgroundColor: '#ff3b30',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },

  deleteText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },

  // Admin Panel Styles
  adminUserCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
  },

  adminUserInfo: {
    flex: 1,
  },

  adminUserEmail: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },

  adminUserDate: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },

  adminUserOrcamentos: {
    fontSize: 13,
    color: '#C97B2A',
    fontWeight: '600',
  },

  deleteAdminBtn: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },

  deleteAdminText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
});
