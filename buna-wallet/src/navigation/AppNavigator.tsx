import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors, Typography, BorderRadius } from '../theme';
import { SplashScreen } from '../screens/SplashScreen';
import { BunaOnboardingScreen } from '../screens/BunaOnboardingScreen';
import { PINScreen } from '../screens/PINScreen';
import { OTPScreen } from '../screens/OTPScreen';
import { BiometricSetupScreen } from '../screens/BiometricSetupScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { AccountsScreen } from '../screens/AccountsScreen';
import { WalletScreen } from '../screens/WalletScreen';
import { RewardsScreen } from '../screens/RewardsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { QRScanScreen } from '../screens/QRScanScreen';
import { DepositScreen } from '../screens/DepositScreen';
import { WithdrawScreen } from '../screens/WithdrawScreen';
import { TransferScreen } from '../screens/TransferScreen';
import { CasinoBridgeScreen } from '../screens/CasinoBridgeScreen';
import { useAuth } from '../context/AuthContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ─── Bottom Tab Bar ───────────────────────────────────────────────────────────
function CustomTabBar({ state, descriptors, navigation }: any) {
  const tabs = [
    { name: 'Home',     icon: 'home-outline',    activeIcon: 'home',    label: 'Home' },
    { name: 'Accounts', icon: 'wallet-outline',  activeIcon: 'wallet',  label: 'Accounts' },
    { name: 'QR',       icon: 'qr-code-outline', activeIcon: 'qr-code', label: 'Scan' },
    { name: 'Wallet',   icon: 'card-outline',    activeIcon: 'card',    label: 'Wallet' },
    { name: 'Profile',  icon: 'person-outline',  activeIcon: 'person',  label: 'Profile' },
  ];

  return (
    <View style={tabStyles.container}>
      <View style={tabStyles.bar}>
        {state.routes.map((route: any, index: number) => {
          const tab = tabs[index];
          const isFocused = state.index === index;
          const isCenter = tab.name === 'QR';

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          // Center QR button — special style with white border for cut-out effect
          if (isCenter) {
            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                activeOpacity={0.9}
                style={tabStyles.qrWrapper}
              >
                <View style={tabStyles.qrBtn}>
                  <Ionicons name="qr-code-outline" size={28} color="#fff" />
                </View>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.7}
              style={tabStyles.tabItem}
            >
              <Ionicons
                name={(isFocused ? tab.activeIcon : tab.icon) as any}
                size={24}
                color={isFocused ? '#D4AF37' : '#B0B0B0'}
              />
              <Text style={[
                tabStyles.label,
                isFocused && tabStyles.labelActive,
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Main Tab Navigator ───────────────────────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home"     component={HomeScreen} />
      <Tab.Screen name="Accounts" component={AccountsScreen} />
      <Tab.Screen name="QR"       component={QRScanScreen} />
      <Tab.Screen name="Wallet"   component={WalletScreen} />
      <Tab.Screen name="Profile"  component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// ─── Authenticated Root Stack ───────────────────────────────────────────────────
export type RootStackParamList = {
  MainTabs: undefined;
  Deposit: undefined;
  Withdraw: undefined;
  Transfer: undefined;
  CasinoBridge: undefined;
};
const AuthenticatedStack = createNativeStackNavigator<RootStackParamList>();

function AuthenticatedNavigator() {
  return (
    <AuthenticatedStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthenticatedStack.Screen name="MainTabs" component={MainTabs} />
      <AuthenticatedStack.Screen name="Deposit" component={DepositScreen} />
      <AuthenticatedStack.Screen name="Withdraw" component={WithdrawScreen} />
      <AuthenticatedStack.Screen name="Transfer" component={TransferScreen} />
      <AuthenticatedStack.Screen name="CasinoBridge" component={CasinoBridgeScreen} />
    </AuthenticatedStack.Navigator>
  );
}

// ─── Root Navigator ────────────────────────────────────────────────────────────
export const AppNavigator: React.FC = () => {
  const { step, goToLogin } = useAuth();

  if (step === 'splash') {
    return <SplashScreen onFinish={goToLogin} />;
  }

  if (step === 'login') {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="Login" component={BunaOnboardingScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  if (step === 'otp') {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="OTP" component={OTPScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  if (step === 'pin_setup' || step === 'pin_login') {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="PIN" component={PINScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  if (step === 'biometric_setup') {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="BiometricSetup" component={BiometricSetupScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  // Authenticated — show main app
  return (
    <NavigationContainer>
      <AuthenticatedNavigator />
    </NavigationContainer>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const tabStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    paddingBottom: 24, // adjust for home indicator on iOS
    paddingTop: 10,
    paddingHorizontal: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    color: '#B0B0B0',
    marginTop: 4,
    fontWeight: '500',
  },
  labelActive: {
    color: '#D4AF37',
    fontWeight: '600',
  },
  // Center QR button
  qrWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -35,
    paddingHorizontal: 8,
  },
  qrBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#D4AF37',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 6,
    borderColor: '#FFFFFF',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
