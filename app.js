import React, { useState, useEffect } from "react";

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Linking,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";


// ================= HASH =================

const SECRET="@MinhaChave123";

function hash(text){

let h=0;

const str=text+SECRET;

for(let i=0;i<str.length;i++){

h=((h<<5)-h)+str.charCodeAt(i);

h|=0;

}

return Math.abs(h).toString();

}


// ================= DATABASE =================

const DB={

async get(key){

try{

const value=
await AsyncStorage.getItem(key);

return value
?JSON.parse(value)
:[];

}catch{

return[];

}

},

async save(key,data){

await AsyncStorage.setItem(
key,
JSON.stringify(data)
);

}

};


// ================= AUTH =================

const Auth={

async register(email,password){

let users=
await DB.get("users");

const exists=
users.find(
u=>u.email===email
);

if(exists){

throw Error();

}

users.push({

id:Date.now(),

email,

password:
hash(password)

});

await DB.save(
"users",
users
);

},

async login(email,password){

let users=
await DB.get("users");

const user=
users.find(

u=>

u.email===email &&

u.password===
hash(password)

);

return !!user;

}

};


// ================= ORÇAMENTO =================

const Orcamento={

async save(item){

let lista=
await DB.get(
"orcamentos"
);

lista.unshift({

id:Date.now(),

...item

});

await DB.save(
"orcamentos",
lista
);

},

async list(){

return await DB.get(
"orcamentos"
);

}

};


// ================= LOGIN =================

function LoginScreen({onLogin}){

const {width}=useWindowDimensions();

const[email,setEmail]=
useState("");

const[password,setPassword]=
useState("");

const[confirm,setConfirm]=
useState("");

const[isLogin,setIsLogin]=
useState(true);

const[loading,setLoading]=
useState(false);


async function handle(){

if(!email||!password){

Alert.alert(
"Erro",
"Preencha todos os campos"
);

return;

}

setLoading(true);


if(!isLogin){

if(password!==confirm){

Alert.alert(
"Erro",
"As senhas são diferentes"
);

setLoading(false);

return;

}

try{

await Auth.register(
email,
password
);

Alert.alert(
"Sucesso",
"Conta criada"
);

setEmail("");
setPassword("");
setConfirm("");
setIsLogin(true);

}catch{

Alert.alert(
"Erro",
"Usuário já existe"
);

}

setLoading(false);

return;

}


const ok=
await Auth.login(
email,
password
);

setLoading(false);


if(ok){

onLogin();

}else{

Alert.alert(
"Erro",
"Login inválido"
);

}

}


return(

<KeyboardAvoidingView

style={styles.flex}

behavior={
Platform.OS==="ios"
?"padding"
:"height"
}

>

<ScrollView

contentContainerStyle={{

flexGrow:1,

justifyContent:"center",

padding:
width<400
?20
:30

}}

keyboardShouldPersistTaps="handled"

style={styles.container}

>

<Text style={styles.title}>
Etiquetas
</Text>


<TextInput
style={styles.input}
placeholder="Email"
autoCapitalize="none"
value={email}
onChangeText={setEmail}
/>


<TextInput
style={styles.input}
placeholder="Senha"
secureTextEntry
value={password}
onChangeText={setPassword}
/>


{
!isLogin&&(

<TextInput
style={styles.input}
placeholder="Confirmar senha"
secureTextEntry
value={confirm}
onChangeText={setConfirm}
/>

)
}


<TouchableOpacity
style={styles.button}
onPress={handle}
>

{
loading

?

<ActivityIndicator
color="#fff"
/>

:

<Text style={styles.btnText}>
{
isLogin
?"ENTRAR"
:"CADASTRAR"
}
</Text>

}

</TouchableOpacity>


<TouchableOpacity
onPress={()=>
setIsLogin(
!isLogin
)
}
>

<Text style={styles.link}>
{
isLogin
?"Criar conta"
:"Já tenho conta"
}
</Text>

</TouchableOpacity>

</ScrollView>

</KeyboardAvoidingView>

)

}



// ================= HOME =================

function Home({onLogout}){

const {width}=useWindowDimensions();

const[qtd,setQtd]=
useState("");

const[preco,setPreco]=
useState("");

const[tamanho,setTamanho]=
useState("");

const[material,setMaterial]=
useState("");

const[impressao,setImpressao]=
useState("");

const[obs,setObs]=
useState("");

const[list,setList]=
useState([]);


useEffect(()=>{

load();

},[]);


async function load(){

const dados=
await Orcamento.list();

setList(dados);

}


const total=(

(+qtd||0)
*
(+preco||0)

).toFixed(2);



async function salvar(){

if(!qtd||!preco){

Alert.alert(
"Erro",
"Preencha quantidade e preço"
);

return;

}

await Orcamento.save({

quantidade:qtd,

precoUnitario:preco,

tamanho,

material,

impressao,

obs,

total

});


setQtd("");
setPreco("");
setTamanho("");
setMaterial("");
setImpressao("");
setObs("");

load();

}



async function remover(id){

let lista=
await Orcamento.list();

lista=
lista.filter(
i=>i.id!==id
);

await DB.save(
"orcamentos",
lista
);

load();

}


function whatsapp(item){

const msg=

`*ORÇAMENTO DE ETIQUETA*

Quantidade:
${item.quantidade}

Preço:
R$ ${item.precoUnitario}

Tamanho:
${item.tamanho}

Material:
${item.material}

Impressão:
${item.impressao}

Observação:
${item.obs}

TOTAL:
R$ ${item.total}`;

Linking.openURL(

`https://wa.me/?text=${
encodeURIComponent(msg)
}`

);

}


return(

<KeyboardAvoidingView
style={styles.flex}
behavior={
Platform.OS==="ios"
?"padding"
:"height"
}
>

<FlatList

style={styles.container}

ListHeaderComponent={

<View>

<View
style={styles.header}
>

<Text
style={styles.subtitle}
>

Novo orçamento

</Text>

<TouchableOpacity
style={styles.logout}
onPress={onLogout}
>

<Text style={styles.btnText}>
SAIR
</Text>

</TouchableOpacity>

</View>



<TextInput
style={styles.input}
placeholder="Quantidade"
keyboardType="numeric"
value={qtd}
onChangeText={setQtd}
/>


<TextInput
style={styles.input}
placeholder="Preço Unitário"
keyboardType="numeric"
value={preco}
onChangeText={setPreco}
/>


<TextInput
style={styles.input}
placeholder="Tamanho"
value={tamanho}
onChangeText={setTamanho}
/>


<TextInput
style={styles.input}
placeholder="Material"
value={material}
onChangeText={setMaterial}
/>


<TextInput
style={styles.input}
placeholder="Tipo impressão"
value={impressao}
onChangeText={setImpressao}
/>


<TextInput
style={styles.input}
placeholder="Observações"
multiline
value={obs}
onChangeText={setObs}
/>


<Text style={styles.total}>
R$ {total}
</Text>


<TouchableOpacity
style={styles.button}
onPress={salvar}
>

<Text style={styles.btnText}>
SALVAR
</Text>

</TouchableOpacity>

</View>

}

data={list}

contentContainerStyle={{
padding:
width<400
?15
:20,

paddingBottom:50
}}

keyExtractor={i=>
i.id.toString()
}

renderItem={({item})=>(

<View style={styles.card}>

<Text style={styles.valor}>
R$ {item.total}
</Text>

<Text>
Quantidade:
{item.quantidade}
</Text>

<Text>
Preço:
R$ {item.precoUnitario}
</Text>

<Text>
Tamanho:
{item.tamanho}
</Text>

<Text>
Material:
{item.material}
</Text>

<Text>
Impressão:
{item.impressao}
</Text>

<Text>
Obs:
{item.obs}
</Text>


<TouchableOpacity
style={styles.wpp}
onPress={()=>
whatsapp(item)
}
>

<Text style={styles.btnText}>
Enviar WhatsApp
</Text>

</TouchableOpacity>


<TouchableOpacity

style={styles.delete}

onPress={()=>

Alert.alert(
"Excluir",
"Deseja remover?",
[
{
text:"Cancelar"
},
{
text:"Remover",
onPress:()=>
remover(item.id)
}
]
)

}

>

<Text style={styles.btnText}>
Remover orçamento
</Text>

</TouchableOpacity>

</View>

)}

keyboardShouldPersistTaps="handled"

/>

</KeyboardAvoidingView>

)

}


// ================= APP =================

export default function App(){

const[
screen,
setScreen
]=useState(
"login"
);

return(

<SafeAreaView
style={styles.flex}
>

{
screen==="login"

?

<LoginScreen
onLogin={()=>
setScreen(
"home"
)
}
/>

:

<Home
onLogout={()=>
setScreen(
"login"
)
}
/>

}

</SafeAreaView>

)

}


// ================= STYLES =================

const styles=StyleSheet.create({

flex:{
flex:1
},

container:{
flex:1,
backgroundColor:"#C97B2A"
},

title:{
fontSize:32,
fontWeight:"bold",
color:"#fff",
textAlign:"center",
marginBottom:30
},

subtitle:{
fontSize:25,
fontWeight:"bold",
color:"#fff"
},

header:{
flexDirection:"row",
justifyContent:"space-between",
alignItems:"center",
marginBottom:20
},

input:{
backgroundColor:"#fff",
padding:14,
borderRadius:10,
marginBottom:10,
fontSize:16
},

button:{
backgroundColor:"#007AFF",
padding:15,
borderRadius:10,
alignItems:"center",
marginTop:5
},

btnText:{
color:"#fff",
fontWeight:"bold",
fontSize:15
},

link:{
marginTop:20,
textAlign:"center",
color:"#fff",
fontSize:16
},

logout:{
backgroundColor:"#ff3b30",
paddingHorizontal:15,
paddingVertical:10,
borderRadius:10
},

total:{
fontSize:28,
fontWeight:"bold",
textAlign:"center",
color:"#fff",
marginVertical:20
},

card:{
backgroundColor:"#fff",
padding:15,
borderRadius:12,
marginTop:15
},

valor:{
fontSize:24,
fontWeight:"bold",
marginBottom:10
},

wpp:{
backgroundColor:"#25D366",
padding:12,
borderRadius:8,
alignItems:"center",
marginTop:15
},

delete:{
backgroundColor:"#ff3b30",
padding:12,
borderRadius:8,
alignItems:"center",
marginTop:10
}

});
