import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DB={
 async get(name){
   try{
     const data=await AsyncStorage.getItem(name);
     return data?JSON.parse(data):{};
   }catch{return {}}
 },
 async save(name,data){
   await AsyncStorage.setItem(name,JSON.stringify(data));
 }
}

async function initDB(){
 const users=await DB.get('@users');
 const orc=await DB.get('@orc');
 const feedback=await DB.get('@feedbacks');
 if(!Object.keys(users).length) await DB.save('@users',{});
 if(!Object.keys(orc).length) await DB.save('@orc',{});
 if(!Object.keys(feedback).length) await DB.save('@feedbacks',{});
}

const AuthService={
 currentUser:null,
 hash(str){
 let h=0;
 for(let i=0;i<str.length;i++){
 h=((h<<5)-h)+str.charCodeAt(i);h|=0;
 }
 return h.toString();
 },
 async register(email,password){
 const users=await DB.get('@users');
 const key=email.toLowerCase().trim();
 if(users[key]) return {success:false,error:'Email já cadastrado'};
 users[key]={id:Date.now().toString(),email:key,password:this.hash(password+key)};
 await DB.save('@users',users);
 return {success:true};
 },
 async login(email,password){
 const users=await DB.get('@users');
 const key=email.toLowerCase().trim();
 const user=users[key];
 if(!user) return {success:false,error:'Usuário não cadastrado'};
 if(this.hash(password+key)!==user.password) return {success:false,error:'Senha incorreta'};
 await AsyncStorage.setItem('@session',JSON.stringify(user));
 return {success:true,user};
 },
 async restore(){
 const data=await AsyncStorage.getItem('@session');
 return data?JSON.parse(data):null;
 },
 async logout(){await AsyncStorage.removeItem('@session')}
}

const OrcamentoService={
 async save(userId,data){
 const db=await DB.get('@orc');
 const id=Date.now().toString();
 db[id]={id,user_id:userId,...data};
 await DB.save('@orc',db);
 },
 async get(userId){
 const db=await DB.get('@orc');
 return Object.values(db).filter(i=>i.user_id===userId)
 },
 async remove(id){
 const db=await DB.get('@orc');
 delete db[id];
 await DB.save('@orc',db);
 }
}

function LoginScreen({onLogin}){
const[email,setEmail]=useState('');
const[confirmEmail,setConfirmEmail]=useState('');
const[password,setPassword]=useState('');
const[isLogin,setIsLogin]=useState(true);

async function submit(){
if(!email||!password)return Alert.alert('Erro','Preencha tudo');
if(!isLogin){
if(email!==confirmEmail)return Alert.alert('Erro','Emails diferentes');
const r=await AuthService.register(email,password);
return r.success?setIsLogin(true):Alert.alert('Erro',r.error);
}
const r=await AuthService.login(email,password);
r.success?onLogin(r.user):Alert.alert('Erro',r.error);
}
return <ScrollView style={styles.container} contentContainerStyle={styles.center}><Text style={styles.title}>Orçamentos</Text><TextInput style={styles.input} placeholder='Email' value={email} onChangeText={setEmail}/>{!isLogin&&<TextInput style={styles.input} placeholder='Confirmar Email' value={confirmEmail} onChangeText={setConfirmEmail}/>}<TextInput style={styles.input} placeholder='Senha' secureTextEntry value={password} onChangeText={setPassword}/><TouchableOpacity style={styles.button} onPress={submit}><Text style={styles.buttonText}>{isLogin?'ENTRAR':'CADASTRAR'}</Text></TouchableOpacity><TouchableOpacity onPress={()=>setIsLogin(!isLogin)}><Text style={styles.link}>{isLogin?'Não possui conta?':'Já possui conta?'}</Text></TouchableOpacity></ScrollView>
}

function FeedbackScreen({user,voltar}){
const[mensagem,setMensagem]=useState('');
async function enviar(){
if(!mensagem.trim()) return Alert.alert('Erro','Digite algo');
const feedbacks=await DB.get('@feedbacks');
feedbacks[Date.now()]={user:user.email,mensagem};
await DB.save('@feedbacks',feedbacks);
Alert.alert('Sucesso','Feedback enviado');
setMensagem('');
}
return <View style={styles.container}><View style={styles.header}><TouchableOpacity style={styles.logout} onPress={voltar}><Text style={{color:'#fff'}}>Voltar</Text></TouchableOpacity></View><View style={{padding:20}}><Text style={styles.title}>Feedback</Text><TextInput multiline value={mensagem} onChangeText={setMensagem} style={styles.feedbackInput} placeholder='Digite sua opinião'/><TouchableOpacity style={styles.button} onPress={enviar}><Text style={styles.buttonText}>Enviar Feedback</Text></TouchableOpacity></View></View>
}

function Home({user,logout,abrirFeedback}){
const[lista,setLista]=useState([])
const[orc,setOrc]=useState({quantidade:'',preco:'',material:''})
useEffect(()=>{carregar()},[])
async function carregar(){setLista(await OrcamentoService.get(user.id))}
const total=()=>((parseFloat(orc.quantidade)||0)*(parseFloat(String(orc.preco).replace(',','.'))||0)).toFixed(2)
async function salvar(){await OrcamentoService.save(user.id,{...orc,total:total()});setOrc({quantidade:'',preco:'',material:''});carregar()}
return <View style={styles.container}><View style={styles.header}><Text style={styles.email}>{user.email}</Text><TouchableOpacity style={styles.logout} onPress={logout}><Text style={{color:'#fff'}}>Sair</Text></TouchableOpacity></View><View style={{padding:20}}><TextInput style={styles.input} placeholder='Quantidade' value={orc.quantidade} onChangeText={t=>setOrc({...orc,quantidade:t})}/><TextInput style={styles.input} placeholder='Preço' value={orc.preco} onChangeText={t=>setOrc({...orc,preco:t})}/><TextInput style={styles.input} placeholder='Material' value={orc.material} onChangeText={t=>setOrc({...orc,material:t})}/><Text style={styles.total}>R$ {total()}</Text><TouchableOpacity style={styles.button} onPress={salvar}><Text style={styles.buttonText}>Salvar</Text></TouchableOpacity><TouchableOpacity style={styles.button} onPress={abrirFeedback}><Text style={styles.buttonText}>Feedback</Text></TouchableOpacity></View><FlatList data={lista} keyExtractor={i=>i.id} renderItem={({item})=><View style={styles.card}><View><Text style={styles.valor}>R$ {item.total}</Text><Text>Qtd: {item.quantidade}</Text><Text>Material: {item.material}</Text></View><TouchableOpacity style={styles.delete} onPress={async()=>{await OrcamentoService.remove(item.id);carregar()}}><Text style={{color:'#fff'}}>X</Text></TouchableOpacity></View>}/></View>
}

export default function App(){
const[user,setUser]=useState(null)
const[loading,setLoading]=useState(true)
const[tela,setTela]=useState('home')
useEffect(()=>{(async()=>{await initDB();const u=await AuthService.restore();if(u)setUser(u);setLoading(false)})()},[])
if(loading)return <SafeAreaView style={styles.center}><ActivityIndicator/></SafeAreaView>
if(!user)return <LoginScreen onLogin={setUser}/>
if(tela==='feedback') return <FeedbackScreen user={user} voltar={()=>setTela('home')}/>
return <Home user={user} abrirFeedback={()=>setTela('feedback')} logout={async()=>{await AuthService.logout();setUser(null)}}/>
}

const styles=StyleSheet.create({container:{flex:1,backgroundColor:'#C97B2A'},center:{flexGrow:1,justifyContent:'center',padding:20},title:{fontSize:32,color:'#fff',fontWeight:'bold',textAlign:'center',marginBottom:30},input:{backgroundColor:'#fff',padding:15,borderRadius:10,marginBottom:10},button:{backgroundColor:'#007AFF',padding:15,borderRadius:10,marginTop:10},buttonText:{color:'#fff',fontWeight:'bold',textAlign:'center'},link:{color:'#fff',textAlign:'center',marginTop:20},header:{padding:20,flexDirection:'row',justifyContent:'space-between'},email:{color:'#fff',fontWeight:'bold'},logout:{backgroundColor:'red',padding:10,borderRadius:10},total:{color:'#fff',fontSize:24,fontWeight:'bold',marginVertical:20},card:{backgroundColor:'#fff',padding:15,margin:10,borderRadius:10,flexDirection:'row',justifyContent:'space-between'},valor:{fontWeight:'bold',fontSize:20},delete:{backgroundColor:'red',width:35,height:35,borderRadius:18,justifyContent:'center',alignItems:'center'},feedbackInput:{backgroundColor:'#fff',minHeight:150,padding:15,borderRadius:10}})

                                                                      
