import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors, Typography, BorderRadius } from '../theme';
import { SplashScreen } from '../screens/SplashScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { OTPScreen } from '../screens/OTPScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { WalletScreen } from '../screens/WalletScreen';
import { RewardsScreen } from '../screens/RewardsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { QRScanScreen } from '../screens/QRScanScreen';
import { DepositScreen } from '../screens/DepositScreen';
import { useAuth } from '../context/AuthContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ─── Bottom Tab Bar ───────────────────────────────────────────────────────────
function CustomTabBar({ state, descriptors, navigation }: any) {
  const tabs = [
    { name: 'Home',    icon: 'home',    activeIcon: 'home',    label: 'Home' },
    { name: 'Wallet',  icon: 'wallet-outline', activeIcon: 'wallet', label: 'Wallet' },
    { name: 'QR',      icon: 'qr-code-outline', activeIcon: 'qr-code', label: 'Scan' },
    { name: 'Rewards', icon: 'gift-outline', activeIcon: 'gift',  label: 'Rewards' },
    { name: 'Profile', icon: 'person-outline', activeIcon: 'person', label: 'Profile' },
  ];

  return (
    <View style={tabStyles.container}>
      <LinearGradient
        colors={['rgba(15,17,21,0)', 'rgba(15,17,21,0.98)', '#0F1115']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
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

          // Center QR button — special style
          if (isCenter) {
            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                activeOpacity={0.8}
                style={tabStyles.qrWrapper}
              >
                <LinearGradient
                  colors={['#7B3CB3', '#5B2C83']}
                  style={tabStyles.qrBtn}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="qr-code" size={26} color="#fff" />
                </LinearGradient>
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
              {isFocused && (
                <LinearGradient
                  colors={['rgba(245,176,65,0.15)', 'transparent']}
                  style={tabStyles.activeGlow}
                />
              )}
              <Ionicons
                name={(isFocused ? tab.activeIcon : tab.icon) as any}
                size={22}
                color={isFocused ? Colors.secondary : Colors.textMuted}
              />
              <Text style={[
                tabStyles.label,
                isFocused && tabStyles.labelActive,
              ]}>
                {tab.label}
              </Text>
              {isFocused && <View style={tabStyles.activeIndicator} />}
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
      <Tab.Screen name="Home"    component={HomeScreen} />
      <Tab.Screen name="Wallet"  component={WalletScreen} />
      <Tab.Screen name="QR"      component={QRScanScreen} />
      <Tab.Screen name="Rewards" component={RewardsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// ─── Authenticated Root Stack ───────────────────────────────────────────────────
export type RootStackParamList = {
  MainTabs: undefined;
  Deposit: undefined;
};
const AuthenticatedStack = createNativeStackNavigator<RootStackParamList>();

function AuthenticatedNavigator() {
  return (
    <AuthenticatedStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthenticatedStack.Screen name="MainTabs" component={MainTabs} />
      <AuthenticatedStack.Screen name="Deposit" component={DepositScreen} />
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
          <Stack.Screen name="Login" component={LoginScreen} />
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
    paddingBottom: 24,
    paddingTop: 8,
  },
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    marginHorizontal: 16,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius['2xl'],
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 20,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingVertical: 4,
    position: 'relative',
    minHeight: 52,
  },
  activeGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: BorderRadius.lg,
  },
  label: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
    fontWeight: Typography.weight.medium,
  },
  labelActive: {
    color: Colors.secondary,
    fontWeight: Typography.weight.semiBold,
  },
  activeIndicator: {
    position: 'absolute',
    top: -10,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.secondary,
  },
  // Center QR button
  qrWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    paddingHorizontal: 8,
  },
  qrBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.background,
    shadowColor: '#5B2C83',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
});
