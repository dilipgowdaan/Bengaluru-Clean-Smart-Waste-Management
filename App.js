import 'react-native-gesture-handler'; // MUST BE THE FIRST IMPORT
import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, 
  Alert, ScrollView, Dimensions, KeyboardAvoidingView, Platform, Modal, 
  StatusBar, Animated, Easing, Image 
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker'; // Camera
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  onAuthStateChanged, signOut, initializeAuth, getReactNativePersistence
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, query, where, onSnapshot, 
  doc, setDoc, updateDoc, orderBy, serverTimestamp, getDoc, getDocs 
} from 'firebase/firestore';

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: "API_KEY",
  authDomain: "smartwaste1.firebaseapp.com",
  projectId: "smartwaste1",
  storageBucket: "smartwaste1.firebasestorage.app",
  messagingSenderId: "360309400984",
  appId: "1:360309400984:web:2d63e29098f5f92cdc77ed",
  measurementId: "G-JZ9R68G262"
};

// Initialize Firebase with persistence
const app = initializeApp(firebaseConfig);
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});
const db = getFirestore(app);

// --- CONSTANTS ---
const { width, height } = Dimensions.get('window');
const SIDEBAR_WIDTH = width * 0.75;
const JAYANAGAR_LOC = { latitude: 12.92415, longitude: 77.58626, latitudeDelta: 0.05, longitudeDelta: 0.05 };

const THEME = {
  primary: '#047857', // Emerald 700
  secondary: '#1E3A8A', // Blue 900
  accent: '#F59E0B', // Amber 500
  danger: '#EF4444',
  success: '#10B981',
  disabled: '#94A3B8',
  background: '#F8FAFC',
  card: '#FFFFFF',
  text: '#0F172A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  sidebar: '#0F172A', // Slate 900
};

// --- GLOBAL CONTEXT ---
const AppContext = React.createContext();

// --- HELPER: FORMAT DATE ---
const formatDate = (timestamp) => {
  if (!timestamp) return 'Pending...';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true, day: 'numeric', month: 'short' });
};

// --- REUSABLE UI COMPONENTS ---

const Header = ({ title, onMenu }) => (
  <View style={styles.header}>
    <View style={styles.headerLeft}>
      <TouchableOpacity onPress={onMenu} style={styles.iconBtn}>
        <Ionicons name="menu" size={28} color={THEME.text} />
      </TouchableOpacity>
      <View style={{marginLeft: 12}}>
        <Text style={styles.headerTitle}>Bengaluru<Text style={{fontWeight:'300'}}>Clean</Text></Text>
        <Text style={styles.headerSub}>{title}</Text>
      </View>
    </View>
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{auth.currentUser?.email?.[0].toUpperCase()}</Text>
    </View>
  </View>
);

const Card = ({ children, style }) => <View style={[styles.card, style]}>{children}</View>;

const StatusBadge = ({ status }) => {
  let bg = '#E2E8F0'; let color = '#64748B';
  if(status === 'Pending') { bg = '#FFF7ED'; color = '#C2410C'; }
  if(status === 'Assigned') { bg = '#EFF6FF'; color = '#1D4ED8'; }
  if(status === 'Completed') { bg = '#F0FDF4'; color = '#15803D'; }
  
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: color }]}>{status}</Text>
    </View>
  );
};

// --- TIMELINE COMPONENT (NEW) ---
const TimelineItem = ({ title, date, sub, icon, color, isLast, isActive }) => (
  <View style={{flexDirection:'row', height: isLast ? 'auto' : 80}}>
    <View style={{alignItems:'center', marginRight:15, width: 30}}>
      <View style={{width: 30, height: 30, borderRadius: 15, backgroundColor: isActive ? color : '#E2E8F0', justifyContent:'center', alignItems:'center', zIndex:2}}>
        <Ionicons name={icon} size={16} color={isActive ? 'white' : '#94A3B8'} />
      </View>
      {!isLast && <View style={{width: 2, flex:1, backgroundColor: isActive ? color : '#E2E8F0', marginVertical: -5}} />}
    </View>
    <View style={{flex:1, paddingBottom: 20}}>
      <Text style={{fontWeight:'bold', color: isActive ? THEME.text : '#94A3B8', fontSize: 16}}>{title}</Text>
      <Text style={{color: THEME.textSecondary, fontSize: 12, marginTop: 2}}>{date}</Text>
      {sub && <Text style={{color: THEME.textSecondary, fontSize: 13, fontStyle:'italic', marginTop: 4}}>{sub}</Text>}
    </View>
  </View>
);

// --- SCREENS COMPONENTS ---

// 1. HELP & SUPPORT (Shared)
const HelpSupportScreen = () => (
  <ScrollView style={styles.pageContent}>
    <Card>
      <Text style={styles.sectionTitle}>Contact Support</Text>
      <View style={styles.contactRow}>
        <Ionicons name="call" size={20} color={THEME.primary} />
        <Text style={styles.contactText}>BBMP Helpline: 1533</Text>
      </View>
      <View style={styles.contactRow}>
        <Ionicons name="mail" size={20} color={THEME.primary} />
        <Text style={styles.contactText}>support@bengaluruclean.gov.in</Text>
      </View>
      <View style={styles.contactRow}>
        <Ionicons name="location" size={20} color={THEME.primary} />
        <Text style={styles.contactText}>BBMP Head Office, Hudson Circle</Text>
      </View>
    </Card>
  </ScrollView>
);

// 2. PROFILE (Shared)
const ProfileScreen = () => {
  const { userData } = useContext(AppContext);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userData) {
      setName(userData.name || userData.email?.split('@')[0]);
      setPhone(userData.phone || '');
      setAddress(userData.address || '');
    }
  }, [userData]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, { name, phone, address });
      
      if (userData.role === 'Worker') {
        const workerRef = doc(db, 'workers', auth.currentUser.uid);
        await updateDoc(workerRef, { name, phone });
      }
      
      Alert.alert("Success", "Profile Updated!");
      setIsEditing(false);
    } catch (e) {
      Alert.alert("Error", e.message);
    }
    setLoading(false);
  };

  return (
    <ScrollView style={styles.pageContent}>
      <View style={styles.profileHeader}>
        <View style={styles.profileAvatarLarge}>
          <Text style={styles.profileAvatarText}>{userData?.email?.[0].toUpperCase()}</Text>
        </View>
        <Text style={styles.profileName}>{userData?.name || userData?.email?.split('@')[0]}</Text>
        <Text style={styles.profileRole}>{userData?.role?.toUpperCase()}</Text>
      </View>
      
      <Card>
        <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 15}}>
          <Text style={styles.sectionTitle}>Personal Details</Text>
          <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
            <Text style={{color: THEME.primary, fontWeight: 'bold'}}>{isEditing ? "Cancel" : "Edit"}</Text>
          </TouchableOpacity>
        </View>

        {isEditing ? (
          <View>
            <Text style={styles.label}>Full Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} />
            
            <Text style={styles.label}>Phone Number</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad"/>
            
            <Text style={styles.label}>Address / Location</Text>
            <TextInput style={styles.input} value={address} onChangeText={setAddress} multiline />

            <TouchableOpacity style={styles.btn} onPress={handleSave} disabled={loading}>
               {loading ? <ActivityIndicator color="white"/> : <Text style={styles.btnText}>SAVE CHANGES</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <InfoRow label="Email" value={userData?.email} />
            <InfoRow label="Name" value={userData?.name || 'N/A'} />
            <InfoRow label="Phone" value={userData?.phone || 'N/A'} />
            <InfoRow label="Address" value={userData?.address || 'N/A'} />
            <InfoRow label="User ID" value={auth.currentUser?.uid?.slice(0,8)} />
          </View>
        )}
      </Card>
    </ScrollView>
  );
};

const InfoRow = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

// 3. CITIZEN MODULES

const MyRequestsList = ({ limit }) => {
  const [list, setList] = useState([]);
  
  useEffect(() => {
    if(!auth.currentUser) return;
    const q = query(collection(db, 'requests'), where('user_id', '==', auth.currentUser.uid), orderBy('timestamp', 'desc'));
    return onSnapshot(q, s => setList(s.docs.map(d => ({id: d.id, ...d.data()}))));
  }, []);

  const displayList = limit ? list.slice(0, limit) : list;

  return (
    <View>
      {displayList.map(item => (
        <Card key={item.id} style={{marginBottom: 10, padding: 12}}>
          <View style={{flexDirection:'row', justifyContent:'space-between'}}>
            <View>
              <Text style={styles.rowTitle}>{item.waste_type} Pickup</Text>
              <Text style={styles.rowSub}>{item.timestamp?.toDate ? item.timestamp.toDate().toDateString() : 'Just now'}</Text>
              {item.pickupTime && <Text style={[styles.rowSub, {color: THEME.primary}]}>🕒 {item.pickupTime}</Text>}
            </View>
            <StatusBadge status={item.status} />
          </View>
        </Card>
      ))}
      {displayList.length === 0 && <Text style={styles.emptyText}>No history found</Text>}
    </View>
  );
};

const CitizenDashboard = ({ navigation, setScreen }) => {
  return (
    <ScrollView style={styles.pageContent}>
      <Text style={styles.sectionTitle}>Services</Text>
      <View style={styles.grid}>
        <TouchableOpacity style={styles.gridItem} onPress={() => setScreen('Pickup')}>
          <View style={[styles.gridIcon, {backgroundColor:'#E0F2FE'}]}><Ionicons name="trash" size={24} color="#0284C7"/></View>
          <Text style={styles.gridLabel}>Request Pickup</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.gridItem} onPress={() => Alert.alert("Report", "Feature coming soon")}>
          <View style={[styles.gridIcon, {backgroundColor:'#FEE2E2'}]}><Ionicons name="warning" size={24} color="#DC2626"/></View>
          <Text style={styles.gridLabel}>Grievance</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.gridItem} onPress={() => Alert.alert("Schedule", "Feature coming soon")}>
          <View style={[styles.gridIcon, {backgroundColor:'#FEF3C7'}]}><Ionicons name="calendar" size={24} color="#D97706"/></View>
          <Text style={styles.gridLabel}>Schedule</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.gridItem} onPress={() => Alert.alert("Guide", "Feature coming soon")}>
          <View style={[styles.gridIcon, {backgroundColor:'#D1FAE5'}]}><Ionicons name="book" size={24} color="#059669"/></View>
          <Text style={styles.gridLabel}>Guide</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Recent Activity</Text>
      <MyRequestsList limit={3} />
    </ScrollView>
  );
};

const PickupScreen = ({ setScreen }) => {
  const { userData } = useContext(AppContext);
  const [wasteType, setWasteType] = useState('Dry');
  const [desc, setDesc] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);

  const getLoc = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if(status !== 'granted') {
        Alert.alert("Permission Denied", "Using default location.");
        setLocation(JAYANAGAR_LOC);
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      setLocation({ ...loc.coords, latitudeDelta: 0.005, longitudeDelta: 0.005 });
    } catch (e) {
      setLocation(JAYANAGAR_LOC); 
    }
  };

  useEffect(() => { getLoc(); }, []);

  const submit = async () => {
    // This button requires location. If the map fails, location is null.
    if(!location) return Alert.alert("Location Error", "Map did not load or location not set. Please enable GPS and restart app.");
    if(!pickupTime) return Alert.alert("Error", "Please enter preferred pickup time");
    
    setLoading(true);
    try {
      await addDoc(collection(db, 'requests'), {
        user_id: auth.currentUser.uid,
        user_phone: userData?.phone || 'N/A', 
        user_name: userData?.name || 'Citizen',
        waste_type: wasteType,
        description: desc,
        pickupTime: pickupTime,
        status: 'Pending',
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: serverTimestamp()
      });
      // Add points
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const uSnap = await getDoc(userRef);
      if(uSnap.exists()) {
        await updateDoc(userRef, { points: (uSnap.data().points || 0) + 10 });
      }
      Alert.alert("Success", "Request Sent & 10 Points Earned!");
      setScreen('Dashboard');
    } catch(e) { Alert.alert("Error", e.message); }
    setLoading(false);
  };

  return (
    <ScrollView style={styles.pageContent}>
      <Card>
        <Text style={styles.sectionTitle}>Schedule Pickup</Text>
        <View style={styles.tabs}>
          {['Dry', 'Wet', 'E-Waste'].map(t => (
            <TouchableOpacity key={t} onPress={() => setWasteType(t)} style={[styles.tab, wasteType===t && styles.tabActive]}>
              <Text style={[styles.tabText, wasteType===t && {color:'white'}]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Preferred Time (e.g., 9:30 AM)</Text>
        <TextInput style={styles.input} placeholder="When are you available?" value={pickupTime} onChangeText={setPickupTime} />
        
        <Text style={styles.label}>Instructions</Text>
        <TextInput style={styles.inputArea} placeholder="Landmark or specific details..." value={desc} onChangeText={setDesc} multiline />
        
        <View style={{height: 300, borderRadius: 12, overflow: 'hidden', marginVertical: 12, borderWidth: 1, borderColor: '#ddd'}}>
          {location ? (
            <MapView 
              provider={PROVIDER_GOOGLE}
              style={{flex:1}} 
              initialRegion={location}
              region={location} 
              onPress={(e) => setLocation({...e.nativeEvent.coordinate, latitudeDelta:0.005, longitudeDelta:0.005})}
              showsUserLocation={true}
              showsMyLocationButton={true}
            >
              <Marker coordinate={location} title="Pickup Here" />
            </MapView>
          ) : (
            <View style={{flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'#f0f0f0'}}>
              <ActivityIndicator size="large" color={THEME.primary} />
              <Text style={{marginTop:10, color: '#666'}}>Loading Map...</Text>
            </View>
          )}
          <TouchableOpacity style={styles.gpsBtn} onPress={getLoc}><Ionicons name="locate" size={20} color={THEME.primary}/></TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.btn} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color="white"/> : <Text style={styles.btnText}>SUBMIT REQUEST</Text>}
        </TouchableOpacity>
      </Card>
    </ScrollView>
  );
};

const GreenPointsScreen = () => {
  const [points, setPoints] = useState(0);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const unsubUser = onSnapshot(doc(db, 'users', auth.currentUser.uid), s => setPoints(s.data()?.points || 0));
    const unsubReq = onSnapshot(query(collection(db, 'requests'), where('user_id', '==', auth.currentUser.uid)), s => setHistory(s.docs));
    return () => { unsubUser(); unsubReq(); };
  }, []);

  return (
    <ScrollView style={styles.pageContent}>
      <View style={styles.pointsBanner}>
        <FontAwesome5 name="medal" size={40} color="#FFD700" />
        <View style={{marginLeft: 16}}>
          <Text style={{color:'#D1FAE5', fontSize:14}}>Total Earned</Text>
          <Text style={{color:'white', fontSize:32, fontWeight:'bold'}}>{points} <Text style={{fontSize:16}}>pts</Text></Text>
        </View>
      </View>
      <Text style={styles.sectionTitle}>Points History</Text>
      {history.map((doc, i) => (
        <Card key={doc.id} style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
          <View>
            <Text style={styles.rowTitle}>Contribution #{i+1}</Text>
            <Text style={styles.rowSub}>Waste Pickup</Text>
          </View>
          <Text style={{color: THEME.success, fontWeight:'bold'}}>+10 pts</Text>
        </Card>
      ))}
    </ScrollView>
  );
};

// 4. WORKER MODULES (UPDATED WITH CAMERA & VERIFICATION)
const WorkerDashboard = () => {
  const [onDuty, setOnDuty] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [uploading, setUploading] = useState(false);
  
  useEffect(() => {
    let sub;
    const startTracking = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if(status !== 'granted') return;
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 10 }, async (loc) => {
        if(onDuty) {
          await updateDoc(doc(db, 'workers', auth.currentUser.uid), {
            location: { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
            status: 'Active',
            last_updated: serverTimestamp()
          });
        }
      });
    };

    if(onDuty) startTracking();
    else {
      updateDoc(doc(db, 'workers', auth.currentUser.uid), { status: 'Inactive' }).catch(()=>{});
    }
    return () => { if(sub) sub.remove(); };
  }, [onDuty]);

  useEffect(() => {
    const q = query(collection(db, 'requests'), where('assigned_worker_id', '==', auth.currentUser.uid), where('status', '==', 'Assigned'));
    return onSnapshot(q, s => setTasks(s.docs.map(d => ({id: d.id, ...d.data()}))));
  }, []);

  // NEW: Camera & Upload Logic
  const handleCompleteTask = async (task) => {
    if(!onDuty) return Alert.alert("Off Duty", "Please go ON DUTY first.");

    Alert.alert(
      "Verify Completion",
      "Please take a photo of the cleared waste to complete this job.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Take Photo", onPress: () => takePhoto(task.id) }
      ]
    );
  };

  const takePhoto = async (taskId) => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== 'granted') return Alert.alert("Permission Needed", "Camera access is required.");

      // Use MediaTypeOptions.Images because MediaType is deprecated in SDK 50+
      // This fixes the silent failure/crash
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, 
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.3, // Low quality to keep data size small for Firestore
        base64: true, 
      });

      if (!result.canceled) {
        setUploading(true);
        try {
          const base64Img = `data:image/jpeg;base64,${result.assets[0].base64}`;
          
          await updateDoc(doc(db, 'requests', taskId), {
            status: 'Completed',
            completedAt: serverTimestamp(),
            proofImage: base64Img
          });
          
          Alert.alert("Success", "Job Verified & Completed!");
        } catch (e) {
          Alert.alert("Upload Failed", e.message);
        }
        setUploading(false);
      }
    } catch (error) {
      console.error("Camera Launch Error:", error);
      Alert.alert("Camera Error", "Failed to launch camera. Please check app permissions. Details: " + error.message);
      setUploading(false);
    }
  };

  return (
    <ScrollView style={styles.pageContent}>
      <View style={styles.dutyCard}>
        <View>
          <Text style={styles.dutyLabel}>Current Status</Text>
          <Text style={[styles.dutyStatus, {color: onDuty ? THEME.success : '#94A3B8'}]}>{onDuty ? 'ON DUTY' : 'OFFLINE'}</Text>
        </View>
        <TouchableOpacity style={[styles.toggleBtn, {backgroundColor: onDuty ? THEME.success : '#334155'}]} onPress={() => setOnDuty(!onDuty)}>
          <Ionicons name="power" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Active Jobs</Text>
      {tasks.length === 0 && <Text style={styles.emptyText}>No assigned jobs.</Text>}
      {tasks.map(t => (
        <Card key={t.id}>
          <View style={{flexDirection:'row', justifyContent:'space-between'}}>
            <View style={{flex: 1}}>
              <Text style={styles.rowTitle}>{t.waste_type}</Text>
              <Text style={styles.rowSub}>{t.user_name} • {t.user_phone}</Text>
            </View>
            <TouchableOpacity onPress={() => Alert.alert("Map", "Navigate to location")}>
              <Ionicons name="navigate-circle" size={32} color={THEME.secondary} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.rowSub, {marginTop: 8}]}>{t.description}</Text>
          
          <MapView 
            provider={PROVIDER_GOOGLE}
            style={{height: 250, marginTop:15, borderRadius:8}} 
            initialRegion={{...JAYANAGAR_LOC, latitude: t.latitude, longitude: t.longitude}} 
            scrollEnabled={true}
          >
            <Marker coordinate={{latitude: t.latitude, longitude: t.longitude}} />
          </MapView>
          
          <TouchableOpacity 
            style={[styles.btn, {marginTop:15, height:50, backgroundColor: onDuty ? THEME.success : THEME.disabled}]} 
            onPress={() => handleCompleteTask(t)} 
            disabled={!onDuty || uploading}
          >
            {uploading ? <ActivityIndicator color="white"/> : <Text style={styles.btnText}>📷 VERIFY & COMPLETE</Text>}
          </TouchableOpacity>
        </Card>
      ))}
    </ScrollView>
  );
};

// 5. ADMIN MODULES
const AdminDashboard = () => {
  const [workers, setWorkers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'workers'), s => setWorkers(s.docs.map(d => ({id: d.id, ...d.data()}))));
    const u2 = onSnapshot(collection(db, 'requests'), s => setRequests(s.docs.map(d => ({id: d.id, ...d.data()}))));
    return () => { u1(); u2(); };
  }, []);

  const pending = requests.filter(r => r.status === 'Pending');

  // UPDATED: Save Driver Name and Timestamp
  const handleAssign = async (workerId) => {
    const worker = workers.find(w => w.id === workerId);
    await updateDoc(doc(db, 'requests', selected.id), { 
      status: 'Assigned', 
      assigned_worker_id: workerId,
      assigned_worker_name: worker ? worker.name : 'Unknown Driver',
      assignedAt: serverTimestamp() 
    });
    setSelected(null);
  };

  return (
    <ScrollView style={styles.pageContent}>
      <Card style={{padding:0, overflow:'hidden'}}>
        <MapView provider={PROVIDER_GOOGLE} style={{height: 400}} initialRegion={JAYANAGAR_LOC}>
          {workers.map(w => w.location && w.location.latitude && (
            <Marker key={w.id} coordinate={w.location} title={w.name} description={w.status}>
              <View style={[styles.marker, {backgroundColor: w.status==='Active'?THEME.success:THEME.textSecondary}]}>
                <FontAwesome5 name="truck" size={14} color="white" />
              </View>
            </Marker>
          ))}
          {pending.map(r => r.latitude && (
            <Marker key={r.id} coordinate={{latitude: r.latitude, longitude: r.longitude}} pinColor="orange" />
          ))}
        </MapView>
        <View style={styles.mapOverlay}><Text style={styles.mapText}>Live Fleet</Text></View>
      </Card>

      <Text style={styles.sectionTitle}>Pending Requests ({pending.length})</Text>
      {pending.map(r => (
        <TouchableOpacity key={r.id} onPress={() => setSelected(r)}>
          <Card style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between'}}>
            <View>
              <Text style={styles.rowTitle}>{r.waste_type}</Text>
              <Text style={styles.rowSub}>Time: {r.pickupTime || 'Anytime'}</Text>
            </View>
            <Text style={{color:THEME.primary, fontWeight:'bold'}}>ASSIGN</Text>
          </Card>
        </TouchableOpacity>
      ))}

      <Modal visible={!!selected} transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Assign Driver</Text>
            <Text style={{marginBottom:10}}>Req Time: {selected?.pickupTime || 'N/A'}</Text>
            {workers.map(w => (
              <TouchableOpacity 
                key={w.id} 
                disabled={w.status !== 'Active'}
                style={[styles.modalItem, {opacity: w.status==='Active' ? 1 : 0.5}]} 
                onPress={() => handleAssign(w.id)}
              >
                <View style={[styles.dot, {backgroundColor: w.status==='Active'?THEME.success:'gray'}]} />
                <Text style={{marginLeft:10, fontSize:16}}>{w.name} ({w.status})</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setSelected(null)} style={{marginTop:20, alignItems:'center'}}><Text style={{color:'red'}}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const AdminAnalytics = () => {
  const [data, setData] = useState({ dry:0, wet:0, mixed:0 });
  useEffect(() => {
    return onSnapshot(collection(db, 'requests'), s => {
      let d=0, w=0, m=0;
      s.docs.forEach(doc => {
        const t = doc.data().waste_type;
        if(t==='Dry') d++; else if(t==='Wet') w++; else m++;
      });
      setData({ dry:d, wet:w, mixed:m });
    });
  }, []);

  const total = data.dry + data.wet + data.mixed || 1;

  return (
    <ScrollView style={styles.pageContent}>
      <Text style={styles.sectionTitle}>Waste Composition</Text>
      <Card>
        <View style={styles.chartRow}>
          <View style={{alignItems:'center'}}>
            <View style={[styles.bar, {height: (data.dry/total)*150, backgroundColor:'#F59E0B'}]} />
            <Text>Dry</Text>
            <Text style={{fontWeight:'bold'}}>{data.dry}</Text>
          </View>
          <View style={{alignItems:'center'}}>
            <View style={[styles.bar, {height: (data.wet/total)*150, backgroundColor:'#10B981'}]} />
            <Text>Wet</Text>
            <Text style={{fontWeight:'bold'}}>{data.wet}</Text>
          </View>
          <View style={{alignItems:'center'}}>
            <View style={[styles.bar, {height: (data.mixed/total)*150, backgroundColor:'#3B82F6'}]} />
            <Text>Mixed</Text>
            <Text style={{fontWeight:'bold'}}>{data.mixed}</Text>
          </View>
        </View>
      </Card>
    </ScrollView>
  );
};

// NEW: Detailed Tracking in Admin History
const AdminHistory = () => {
  const [logs, setLogs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'requests'), orderBy('timestamp', 'desc'));
    return onSnapshot(q, s => { setLogs(s.docs.map(d => ({id:d.id, ...d.data()}))); });
  }, []);

  return (
    <View style={{flex:1}}>
      <ScrollView style={styles.pageContent}>
        <Text style={styles.sectionTitle}>Work History</Text>
        {logs.map(l => (
          <TouchableOpacity key={l.id} onPress={() => setSelectedJob(l)}>
            <Card style={{marginBottom:8, flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
              <View>
                <Text style={styles.rowTitle}>{l.waste_type}</Text>
                <Text style={styles.rowSub}>{formatDate(l.timestamp)}</Text>
              </View>
              <StatusBadge status={l.status} />
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* TRACKING DETAILS MODAL */}
      <Modal visible={!!selectedJob} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalFull}>
            <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
              <Text style={styles.modalTitle}>Order Tracking</Text>
              <TouchableOpacity onPress={() => setSelectedJob(null)}><Ionicons name="close-circle" size={30} color="#94A3B8"/></TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedJob && (
                <>
                  <View style={{paddingHorizontal: 10, marginTop: 10}}>
                    {/* Step 1: Placed */}
                    <TimelineItem 
                      title="Pickup Request Placed" 
                      date={formatDate(selectedJob.timestamp)} 
                      sub={`Customer: ${selectedJob.user_name}`}
                      icon="document-text" 
                      color={THEME.accent} 
                      isActive={true} 
                    />
                    
                    {/* Step 2: Assigned */}
                    <TimelineItem 
                      title="Driver Assigned" 
                      date={selectedJob.assignedAt ? formatDate(selectedJob.assignedAt) : 'In Progress...'} 
                      sub={selectedJob.assigned_worker_name ? `Driver: ${selectedJob.assigned_worker_name}` : "Waiting for available driver"}
                      icon="bicycle" 
                      color={THEME.secondary} 
                      isActive={!!selectedJob.assignedAt} 
                    />
                    
                    {/* Step 3: Completed */}
                    <TimelineItem 
                      title="Pickup Completed" 
                      date={selectedJob.completedAt ? formatDate(selectedJob.completedAt) : 'Pending'} 
                      sub={selectedJob.completedAt ? "Verified with Proof of Work" : "Driver is on the way"}
                      icon="checkmark-circle" 
                      color={THEME.success} 
                      isActive={!!selectedJob.completedAt} 
                      isLast={true}
                    />
                  </View>

                  {/* Proof of Work Section */}
                  {selectedJob.proofImage && (
                    <View style={{marginTop: 25}}>
                      <Text style={[styles.sectionTitle, {fontSize:16}]}>Proof of Work</Text>
                      <Image 
                        source={{uri: selectedJob.proofImage}} 
                        style={{width: '100%', height: 250, borderRadius: 12, backgroundColor: '#f0f0f0', borderWidth:1, borderColor: '#eee'}} 
                        resizeMode="cover"
                      />
                      <View style={{flexDirection:'row', alignItems:'center', marginTop:10, backgroundColor:'#F0FDF4', padding:10, borderRadius:8}}>
                        <Ionicons name="shield-checkmark" size={20} color={THEME.success} />
                        <Text style={{color:THEME.success, fontWeight:'bold', marginLeft:8}}>Verified Pickup</Text>
                      </View>
                    </View>
                  )}
                  
                  {/* Map Location */}
                  <View style={{marginTop: 25, marginBottom: 20}}>
                    <Text style={[styles.sectionTitle, {fontSize:16}]}>Location</Text>
                    <MapView 
                      provider={PROVIDER_GOOGLE}
                      style={{height: 150, borderRadius: 12, borderWidth:1, borderColor:'#eee'}} 
                      initialRegion={{
                        latitude: selectedJob.latitude, 
                        longitude: selectedJob.longitude, 
                        latitudeDelta: 0.005, 
                        longitudeDelta: 0.005
                      }}
                    >
                      <Marker coordinate={{latitude: selectedJob.latitude, longitude: selectedJob.longitude}} />
                    </MapView>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  useEffect(() => {
    return onSnapshot(collection(db, 'users'), s => setUsers(s.docs.map(d => ({id:d.id, ...d.data()}))));
  }, []);

  return (
    <ScrollView style={styles.pageContent}>
      <Text style={styles.sectionTitle}>Citizens</Text>
      {users.filter(u => u.role === 'Citizen').map(u => (
        <Card key={u.id} style={{marginBottom:8}}>
          <Text style={styles.rowTitle}>{u.name || u.email}</Text>
          <Text style={styles.rowSub}>Phone: {u.phone || 'N/A'}</Text>
          <Text style={styles.rowSub}>Loc: {u.address || 'N/A'}</Text>
        </Card>
      ))}
      <Text style={styles.sectionTitle}>Workers</Text>
      {users.filter(u => u.role === 'Worker').map(u => (
        <Card key={u.id} style={{marginBottom:8}}>
          <Text style={styles.rowTitle}>{u.name || u.email}</Text>
          <Text style={styles.rowSub}>Phone: {u.phone || 'N/A'}</Text>
          <Text style={styles.rowSub}>Fleet Staff</Text>
        </Card>
      ))}
    </ScrollView>
  );
};

// --- AUTH & NAVIGATION ---

const LoginScreen = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [role, setRole] = useState('Citizen');
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if(!phone || !name) throw new Error("Name and Phone are required");
        if(role === 'Citizen' && !address) throw new Error("Citizens must provide an address");
        
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const userData = { name, email, phone, address, role, points: 0, createdAt: serverTimestamp() };
        
        await setDoc(doc(db, 'users', cred.user.uid), userData);
        
        if (role === 'Worker') {
          await setDoc(doc(db, 'workers', cred.user.uid), {
            name, status: 'Inactive', location: null
          });
        }
      }
    } catch (e) { 
      if(e.code === 'auth/network-request-failed') {
        Alert.alert("No Internet", "Please check your internet connection.");
      } else {
        Alert.alert("Error", e.message); 
      }
    }
    setLoading(false);
  };

  return (
    <View style={styles.loginContainer}>
      <StatusBar barStyle="light-content" />
      <View style={styles.logoBox}>
        <FontAwesome5 name="recycle" size={50} color="white" />
        <Text style={styles.loginTitle}>BengaluruClean</Text>
      </View>
      <ScrollView contentContainerStyle={styles.loginScroll}>
        <View style={styles.loginCard}>
          <Text style={styles.formTitle}>{isLogin ? "Welcome Back" : "Join Us"}</Text>
          <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
          
          {!isLogin && (
            <>
              <TextInput style={styles.input} placeholder="Full Name" value={name} onChangeText={setName} />
              <TextInput style={styles.input} placeholder="Phone Number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              {role === 'Citizen' && <TextInput style={styles.input} placeholder="Home Address (Required)" value={address} onChangeText={setAddress} multiline />}
              <View style={styles.roleRow}>
                {['Citizen', 'Worker', 'Admin'].map(r => (
                  <TouchableOpacity key={r} onPress={() => setRole(r)} style={[styles.roleChip, role===r && styles.roleChipActive]}>
                    <Text style={[styles.roleText, role===r && {color:'white'}]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <TouchableOpacity style={styles.btn} onPress={handleAuth} disabled={loading}>
            {loading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>{isLogin ? "LOGIN" : "SIGN UP"}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={{marginTop:15, alignItems:'center'}}>
            <Text style={{color:THEME.textSecondary}}>{isLogin ? "Create Account" : "Login Instead"}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const MainApp = () => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [userData, setUserData] = useState(null);
  const [screen, setScreen] = useState('Dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        const unsub = onSnapshot(doc(db, 'users', u.uid), (docSnap) => {
          if(docSnap.exists()) {
            setUserData(docSnap.data());
            setRole(docSnap.data().role);
          }
        });
        return () => unsub();
      } else { 
        setUser(null); 
        setRole(null);
        setUserData(null);
      }
    });
  }, []);

  const toggleMenu = () => {
    Animated.timing(slideAnim, {
      toValue: menuOpen ? -SIDEBAR_WIDTH : 0, duration: 300, useNativeDriver: true, easing: Easing.out(Easing.poly(4))
    }).start();
    setMenuOpen(!menuOpen);
  };

  const nav = (s) => { setScreen(s); toggleMenu(); };

  if (!user || !role) return <LoginScreen />;

  let items = [];
  if (role === 'Citizen') items = ['Dashboard', 'Profile', 'History', 'Green Points', 'Support'];
  if (role === 'Worker') items = ['Dashboard', 'Profile', 'Support'];
  if (role === 'Admin') items = ['Dashboard', 'Analytics', 'History', 'Users'];

  const renderScreen = () => {
    if (role === 'Citizen') {
      if (screen === 'Dashboard') return <CitizenDashboard setScreen={setScreen} />;
      if (screen === 'Pickup') return <PickupScreen setScreen={setScreen} />;
      if (screen === 'Profile') return <ProfileScreen />;
      if (screen === 'History') return <View style={styles.pageContent}><Text style={styles.sectionTitle}>History</Text><MyRequestsList /></View>;
      if (screen === 'Green Points') return <GreenPointsScreen />;
      if (screen === 'Support') return <HelpSupportScreen />;
    }
    if (role === 'Worker') {
      if (screen === 'Dashboard') return <WorkerDashboard />;
      if (screen === 'Profile') return <ProfileScreen />;
      if (screen === 'Support') return <HelpSupportScreen />;
    }
    if (role === 'Admin') {
      if (screen === 'Dashboard') return <AdminDashboard />;
      if (screen === 'Analytics') return <AdminAnalytics />;
      if (screen === 'History') return <AdminHistory />;
      if (screen === 'Users') return <UserManagement />;
    }
    return <View><Text>Screen Not Found</Text></View>;
  };

  return (
    <AppContext.Provider value={{ userData, user }}>
      <SafeAreaView style={styles.container}>
        <Header title={screen} onMenu={toggleMenu} />
        {renderScreen()}
        {menuOpen && <TouchableOpacity style={styles.backdrop} onPress={toggleMenu} />}
        <Animated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}>
          <View style={styles.sidebarHead}>
            <View style={styles.avatarLarge}><Text style={styles.avatarTextLarge}>{userData?.email?.[0].toUpperCase()}</Text></View>
            <Text style={{color:'white', fontWeight:'bold', marginTop:10, fontSize:18}}>{userData?.name || 'User'}</Text>
            <Text style={{color:THEME.disabled, fontSize:12}}>{role}</Text>
          </View>
          <View style={{marginTop: 30}}>
            {items.map(i => (
              <TouchableOpacity key={i} style={styles.menuItem} onPress={() => nav(i)}>
                <Ionicons name={getIcon(i)} size={20} color="#E2E8F0" style={{marginRight: 15}} />
                <Text style={{color:'white', fontSize:16, fontWeight:'500'}}>{i}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.logout} onPress={() => signOut(auth)}>
            <Ionicons name="log-out" size={20} color={THEME.danger} />
            <Text style={{color:THEME.danger, marginLeft:10, fontWeight:'bold'}}>Sign Out</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </AppContext.Provider>
  );
};

const getIcon = (name) => {
  if(name === 'Dashboard') return 'home';
  if(name === 'Profile') return 'person';
  if(name === 'History') return 'time';
  if(name === 'Green Points') return 'leaf';
  if(name === 'Support') return 'help-circle';
  if(name === 'Analytics') return 'bar-chart';
  if(name === 'Users') return 'people';
  return 'ellipse';
};

// Wrap everything in SafeAreaProvider and NavigationContainer
export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <MainApp />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  pageContent: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderColor: THEME.border, elevation: 2 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: THEME.primary },
  headerSub: { fontSize: 14, color: THEME.textSecondary },
  iconBtn: { marginRight: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: THEME.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: 'white', fontWeight: 'bold' },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: THEME.text, marginBottom: 12, marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridItem: { width: '48%', backgroundColor: 'white', padding: 16, borderRadius: 16, alignItems: 'center', marginBottom: 16, elevation: 2 },
  gridIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  gridLabel: { fontWeight: '600', color: THEME.text },
  rowTitle: { fontWeight: '600', fontSize: 16 },
  rowSub: { color: THEME.textSecondary, fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: 'bold' },
  label: { fontSize: 14, fontWeight:'600', color:THEME.textSecondary, marginTop:10, marginBottom:5 },
  input: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: THEME.border },
  inputArea: { backgroundColor: '#F1F5F9', borderRadius: 8, padding: 12, height: 80, textAlignVertical: 'top', marginBottom: 12 },
  btn: { backgroundColor: THEME.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  btnText: { color: 'white', fontWeight: 'bold' },
  gpsBtn: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'white', padding: 8, borderRadius: 20, elevation: 3 },
  sidebar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: SIDEBAR_WIDTH, backgroundColor: THEME.sidebar, zIndex: 100, padding: 25, shadowColor: '#000', shadowOffset: { width: 10, height: 0 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 20 },
  backdrop: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 99 },
  sidebarHead: { alignItems: 'center', paddingBottom: 30, borderBottomWidth: 1, borderColor: '#334155' },
  avatarLarge: { width: 70, height: 70, borderRadius: 35, backgroundColor: THEME.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  avatarTextLarge: { color: 'white', fontSize: 28, fontWeight: 'bold' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderColor: '#1F2937' },
  logout: { flexDirection: 'row', alignItems: 'center', marginTop: 'auto', paddingVertical: 20 },
  loginContainer: { flex: 1, backgroundColor: THEME.primary },
  loginScroll: { flexGrow: 1, justifyContent: 'center' },
  logoBox: { alignItems: 'center', marginVertical: 40 },
  loginTitle: { color: 'white', fontSize: 28, fontWeight: 'bold', marginTop: 10 },
  loginCard: { backgroundColor: 'white', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 30, paddingBottom: 60, minHeight: height * 0.6 },
  formTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  roleRow: { flexDirection: 'row', marginBottom: 20, flexWrap:'wrap' },
  roleChip: { padding: 10, alignItems: 'center', borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: THEME.border, marginBottom: 8 },
  roleChipActive: { backgroundColor: THEME.primary, borderColor: THEME.primary },
  roleText: { color: THEME.textSecondary, fontWeight: '600' },
  profileHeader: { alignItems: 'center', padding: 20 },
  profileAvatarLarge: { width: 80, height: 80, borderRadius: 40, backgroundColor: THEME.secondary, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  profileAvatarText: { color: 'white', fontSize: 32, fontWeight: 'bold' },
  profileName: { fontSize: 22, fontWeight: 'bold' },
  profileRole: { color: THEME.textSecondary },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F1F5F9' },
  infoLabel: { color: THEME.textSecondary },
  infoValue: { fontWeight: '600' },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  contactText: { marginLeft: 12, fontSize: 16 },
  dutyCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1E293B', padding: 20, borderRadius: 16, marginBottom: 20 },
  dutyLabel: { color: '#94A3B8', fontSize: 12 },
  dutyStatus: { fontSize: 18, fontWeight: 'bold' },
  toggleBtn: { padding: 12, borderRadius: 24 },
  emptyText: { textAlign: 'center', marginTop: 30, color: THEME.textSecondary },
  marker: { padding: 6, borderRadius: 12, borderWidth: 2, borderColor: 'white' },
  mapOverlay: { position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  mapText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  pointsBanner: { backgroundColor: '#064E3B', borderRadius: 16, padding: 24, flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  chartRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 180, paddingTop: 20 },
  bar: { width: 40, borderRadius: 4, marginBottom: 8 },
  tabs: { flexDirection: 'row', marginBottom: 12 },
  tab: { flex: 1, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: THEME.border, borderRadius: 8, marginRight: 8 },
  tabActive: { backgroundColor: THEME.primary, borderColor: THEME.primary },
  tabText: { fontWeight: '600', color: THEME.textSecondary },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalFull: { backgroundColor: 'white', borderRadius: 16, padding: 20, width: '100%', maxHeight: '80%' },
  modalContent: { backgroundColor: 'white', borderRadius: 16, padding: 20, width: '100%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  modalItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F1F5F9' },
  dot: { width: 10, height: 10, borderRadius: 5 }
});
