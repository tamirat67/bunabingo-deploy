import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { pollTelegramAuth } from '../services/authService';
import { Linking } from 'react-native';

const { width, height } = Dimensions.get('window');

const GOLD = '#D4AF37';
const GOLD_DARK = '#B8860B';
const GOLD_LIGHT = '#F4E0A5';
const TEXT_DARK = '#1C1C1E';
const TEXT_MUTED = '#6E6E73';
const BG_WHITE = '#FFFFFF';
const BORDER_COLOR = '#E5E5EA';

const LANGUAGES = [
  { id: 'en', label: 'English', native: 'English' },
  { id: 'am', label: 'አማርኛ', native: 'Amharic' },
  { id: 'om', label: 'Oromiffa', native: 'Oromiffa' },
  { id: 'ti', label: 'ትግርኛ', native: 'Tigrinya' },
  { id: 'so', label: 'Somali', native: 'Somali' },
];

export const BunaOnboardingScreen: React.FC = () => {
  const { checkPhone, startTelegramAuth, isLoading } = useAuth();

  // Screen State: 'onboarding' | 'language' | 'phone'
  const [screen, setScreen] = useState<'onboarding' | 'language' | 'phone'>('onboarding');
  const [selectedLang, setSelectedLang] = useState('en');
  const [phone, setPhone] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // ── Onboarding Handlers ───────────────────────────────────────────────────
  const handleNextOnboarding = () => {
    if (activeIndex < 2) {
      scrollRef.current?.scrollTo({ x: (activeIndex + 1) * width, animated: true });
    } else {
      setScreen('language');
    }
  };

  const handleSkipOnboarding = () => {
    setScreen('language');
  };

  const handleScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    const roundIndex = Math.round(index);
    if (roundIndex !== activeIndex) {
      setActiveIndex(roundIndex);
    }
  };

  // ── Phone Formatter & Validation ───────────────────────────────────────────
  const handlePhoneChange = (text: string) => {
    // Only allow digits
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 9) {
      setPhone(cleaned);
    }
  };

  const formattedPhoneDisplay = () => {
    let p = phone;
    if (p.length > 3 && p.length <= 5) p = `${p.slice(0, 3)} - ${p.slice(3)}`;
    else if (p.length > 5 && p.length <= 7) p = `${p.slice(0, 3)} - ${p.slice(3, 5)} - ${p.slice(5)}`;
    else if (p.length > 7) p = `${p.slice(0, 3)} - ${p.slice(3, 5)} - ${p.slice(5, 7)} - ${p.slice(7)}`;
    return p;
  };

  const handleContinuePhone = async () => {
    if (phone.length < 9) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid 9-digit phone number (e.g. 0912345678).');
      return;
    }
    await checkPhone(phone); // Call checkPhone which decides OTP or PIN
  };

  const handleTelegramAuth = async () => {
    try {
      const sessionId = await startTelegramAuth();
      const botUsername = 'buna_bingobot';
      const telegramUrl = `https://t.me/${botUsername}?start=auth_${sessionId}`;
      await Linking.openURL(telegramUrl);

      let attempts = 0;
      const maxAttempts = 60;

      const poll = async () => {
        if (attempts >= maxAttempts) return;
        try {
          const res = await pollTelegramAuth(sessionId);
          if (res.status === 'pending') {
            attempts++;
            setTimeout(poll, 2000);
          } else if (res.success && res.token) {
            Alert.alert('Success', 'Logged in via Telegram!');
          }
        } catch (e) {
          console.error(e);
        }
      };
      poll();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Telegram auth failed');
    }
  };

  // ─── RENDER ONBOARDING SLIDES ─────────────────────────────────────────────
  if (screen === 'onboarding') {
    return (
      <LinearGradient colors={['#FFFDF7', '#FFFFFF']} style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFDF7" />

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
        >
          {/* Slide 1 */}
          <View style={[styles.onboardingContent, { width }]}>
            <View style={styles.topRightLogo}>
              <Ionicons name="wallet-outline" size={26} color={TEXT_DARK} />
              <View style={styles.logoTextCol}>
                <Text style={styles.logoTextTop}>Buna</Text>
                <Text style={styles.logoTextBottom}>Wallet</Text>
              </View>
            </View>

            <View style={styles.illustrationArea}>
              <View style={styles.graphicBox}>
                <View style={styles.shopBuilding}>
                  <View style={styles.shopAwning} />
                  <View style={styles.shopDoor}>
                    <Ionicons name="shirt-outline" size={28} color={GOLD_DARK} />
                  </View>
                </View>
                <View style={styles.personWalking}>
                  <Ionicons name="person" size={54} color={TEXT_DARK} />
                  <View style={styles.phoneInHand}>
                    <Ionicons name="qr-code-outline" size={20} color={GOLD} />
                  </View>
                </View>
              </View>
            </View>
            
            <View style={styles.textArea}>
              <Text style={styles.titleText}>
                <Text style={{ color: GOLD }}>Pay </Text>at Shops
              </Text>
              <View style={styles.titleUnderline} />
              <Text style={styles.descText}>
                Pay at shops from your Buna wallet or from your linked bank accounts from 20+ banks via mobile transfers or QR scans.
              </Text>

              {/* Features Grid */}
              <View style={styles.featuresGrid}>
                <View style={styles.featureCard}>
                  <Ionicons name="card-outline" size={26} color={TEXT_DARK} />
                  <Text style={styles.featureText}>Easy{'\n'}Payments</Text>
                </View>
                <View style={styles.featureCard}>
                  <Ionicons name="shield-checkmark-outline" size={26} color={GOLD_DARK} />
                  <Text style={styles.featureText}>Secure{'\n'}& Safe</Text>
                </View>
                <View style={styles.featureCard}>
                  <MaterialCommunityIcons name="bank-outline" size={26} color={TEXT_DARK} />
                  <Text style={styles.featureText}>20+ Banks{'\n'}Connected</Text>
                </View>
                <View style={styles.featureCard}>
                  <Ionicons name="qr-code-outline" size={26} color={TEXT_DARK} />
                  <Text style={styles.featureText}>QR & Mobile{'\n'}Transfers</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Slide 2 */}
          <View style={[styles.onboardingContent, { width }]}>
            <View style={styles.illustrationArea}>
              <View style={styles.graphicBox}>
                <View style={styles.phoneFrame}>
                  <View style={styles.phoneNotch} />
                  <View style={styles.phoneContentLines} />
                  <View style={[styles.badgeItem, { top: 10, left: -25 }]}><Ionicons name="cart" size={18} color="#fff" /></View>
                  <View style={[styles.badgeItem, { top: 10, right: -25 }]}><Ionicons name="flash" size={18} color="#fff" /></View>
                  <View style={[styles.badgeItem, { top: 70, left: -25 }]}><Ionicons name="water" size={18} color="#fff" /></View>
                  <View style={[styles.badgeItem, { top: 70, right: -25 }]}><Ionicons name="globe" size={18} color="#fff" /></View>
                  <View style={[styles.badgeItem, { top: 130, left: -25 }]}><Ionicons name="airplane" size={18} color="#fff" /></View>
                  <View style={[styles.badgeItem, { top: 130, right: -25 }]}><Ionicons name="car" size={18} color="#fff" /></View>
                </View>
                <View style={styles.personStanding}>
                  <Ionicons name="person" size={50} color={TEXT_DARK} />
                </View>
              </View>
            </View>
            <View style={styles.textArea}>
              <Text style={styles.titleText}>
                <Text style={{ color: GOLD }}>Pay </Text>
                for Your Bills
              </Text>
              <Text style={styles.descText}>
                Pay for your bills for utilities like water, electric, airlines ticket, transport, internet, entertainment, deliveries etc
              </Text>
            </View>
          </View>

          {/* Slide 3 */}
          <View style={[styles.onboardingContent, { width }]}>
            <View style={styles.illustrationArea}>
              <View style={styles.graphicBox}>
                <View style={[styles.phoneFrame, { transform: [{ rotate: '15deg' }], width: 140, height: 240 }]}>
                  <View style={styles.phoneNotch} />
                  <View style={styles.merchantCard}><Ionicons name="storefront" size={24} color={TEXT_DARK} /></View>
                  <View style={[styles.merchantCard, { backgroundColor: GOLD_LIGHT }]}><Ionicons name="storefront" size={24} color={GOLD_DARK} /></View>
                  <View style={styles.merchantCard}><Ionicons name="storefront" size={24} color={TEXT_DARK} /></View>
                </View>
                <View style={[styles.personStanding, { left: 10 }]}>
                  <Ionicons name="person-circle-outline" size={60} color={TEXT_DARK} />
                </View>
              </View>
            </View>
            <View style={styles.textArea}>
              <Text style={styles.titleText}>
                <Text style={{ color: GOLD }}>Manage </Text>
                your Business
              </Text>
              <Text style={styles.descText}>
                Manage the flow of your business right from your phone by creating an online shop or store
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Bottom Controls */}
        <View style={styles.bottomBar}>
          <TouchableOpacity onPress={handleSkipOnboarding} activeOpacity={0.7} style={styles.bottomBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
          <View style={styles.dotsRow}>
            <View style={[styles.dot, activeIndex === 0 && styles.dotActive]} />
            <View style={[styles.dot, activeIndex === 1 && styles.dotActive]} />
            <View style={[styles.dot, activeIndex === 2 && styles.dotActive]} />
          </View>
          <TouchableOpacity onPress={handleNextOnboarding} activeOpacity={0.8} style={styles.nextPillBtn}>
            <Text style={styles.nextPillText}>Next</Text>
            <Ionicons name="chevron-forward" size={16} color={TEXT_DARK} />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  // ─── RENDER LANGUAGE SELECTION SCREEN ─────────────────────────────────────
  if (screen === 'language') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={BG_WHITE} />

        {/* Premium Light Header Card */}
        <View style={styles.lightHeaderCard}>
          <Text style={styles.headerTitleDark}>Choose Your{'\n'}Language</Text>
        </View>

        {/* Body Content */}
        <View style={styles.languageBody}>
          <ScrollView contentContainerStyle={styles.langList} showsVerticalScrollIndicator={false}>
            {LANGUAGES.map((lang) => {
              const isSelected = selectedLang === lang.id;
              return (
                <TouchableOpacity
                  key={lang.id}
                  activeOpacity={0.8}
                  onPress={() => setSelectedLang(lang.id)}
                  style={[styles.langCard, isSelected && styles.langCardSelected]}
                >
                  {isSelected ? (
                    <LinearGradient colors={[GOLD, '#C59B27']} style={styles.langGradient}>
                      <Text style={styles.langTextSelected}>{lang.label}</Text>
                    </LinearGradient>
                  ) : (
                    <Text style={styles.langText}>{lang.label}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Bottom Next Button */}
          <TouchableOpacity
            style={styles.langNextBtn}
            activeOpacity={0.7}
            onPress={() => setScreen('phone')}
          >
            <Text style={styles.nextText}>Next</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── RENDER PHONE NUMBER ENTRY SCREEN ─────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={BG_WHITE} />

      {/* Premium Light Header Card */}
      <View style={styles.lightHeaderCard}>
        <Text style={styles.headerTitleDark}>Enter Your{'\n'}Phone Number</Text>
        <Text style={styles.headerSubtitleDark}>
          We will use this to securely log you in.
        </Text>
      </View>

      {/* Phone Input Body */}
      <View style={styles.phoneBody}>
        <ScrollView contentContainerStyle={styles.phoneScroll} keyboardShouldPersistTaps="handled">
          
          {/* Formatted Phone Field */}
          <Text style={styles.fieldLabel}>Mobile Number</Text>
          <View style={styles.phoneInputBox}>
            <Text style={styles.phonePrefix}>ETH  +251</Text>
            <TextInput
              style={styles.phoneInput}
              value={formattedPhoneDisplay()}
              onChangeText={handlePhoneChange}
              placeholder="000 - 00 - 00 - 00"
              placeholderTextColor="#A0A0A0"
              keyboardType="phone-pad"
              maxLength={18}
              autoFocus
            />
          </View>

          {/* Telegram Login Alternative */}
          <TouchableOpacity style={styles.telegramAltBtn} activeOpacity={0.8} onPress={handleTelegramAuth}>
            <Ionicons name="paper-plane" size={18} color="#2AABEE" style={{ marginRight: 8 }} />
            <Text style={styles.telegramAltText}>Or log in with Telegram Bot</Text>
          </TouchableOpacity>

          {/* Terms Disclaimer */}
          <Text style={styles.termsText}>
            I agree to the <Text style={styles.termsBold}>Terms and Conditions</Text> by clicking on the “Continue” button below
          </Text>

          {/* Main Action Button */}
          <TouchableOpacity
            style={[styles.continueBtn, phone.length < 9 && styles.continueBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleContinuePhone}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.continueBtnRow}>
                <Text style={styles.continueBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={22} color="#fff" />
              </View>
            )}
          </TouchableOpacity>

        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_WHITE,
  },

  // ── Onboarding Styles ─────────────────────────────────────────────────────
  onboardingContent: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustrationArea: {
    height: height * 0.42,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  graphicBox: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopBuilding: {
    width: 160,
    height: 140,
    borderWidth: 2,
    borderColor: TEXT_DARK,
    borderRadius: 8,
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    position: 'relative',
  },
  shopAwning: {
    width: '108%',
    height: 32,
    backgroundColor: GOLD,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  shopDoor: {
    width: 60,
    height: 70,
    borderWidth: 2,
    borderColor: TEXT_DARK,
    marginTop: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GOLD_LIGHT,
  },
  personWalking: {
    position: 'absolute',
    left: 30,
    bottom: 20,
  },
  phoneInHand: {
    position: 'absolute',
    top: 10,
    right: -12,
  },

  phoneFrame: {
    width: 150,
    height: 250,
    borderWidth: 3,
    borderColor: TEXT_DARK,
    borderRadius: 24,
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    paddingTop: 12,
    position: 'relative',
  },
  phoneNotch: {
    width: 50,
    height: 10,
    backgroundColor: TEXT_DARK,
    borderRadius: 5,
  },
  phoneContentLines: {
    width: '70%',
    height: 4,
    backgroundColor: '#E0E0E0',
    marginTop: 16,
    borderRadius: 2,
  },
  badgeItem: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  personStanding: {
    position: 'absolute',
    right: 25,
    bottom: 10,
  },
  merchantCard: {
    width: 100,
    height: 50,
    borderWidth: 2,
    borderColor: TEXT_DARK,
    borderRadius: 10,
    marginTop: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  textArea: {
    alignItems: 'center',
    paddingHorizontal: 0,
    width: '100%',
  },
  titleText: {
    fontSize: 32,
    fontWeight: '900',
    color: TEXT_DARK,
    textAlign: 'center',
    marginBottom: 8,
  },
  titleUnderline: {
    width: 48,
    height: 3,
    backgroundColor: GOLD,
    borderRadius: 2,
    marginBottom: 16,
  },
  topRightLogo: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  logoTextCol: {
    marginLeft: 6,
    justifyContent: 'center',
  },
  logoTextTop: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_DARK,
    lineHeight: 14,
  },
  logoTextBottom: {
    fontSize: 14,
    fontWeight: '800',
    color: GOLD,
    lineHeight: 14,
  },
  descText: {
    fontSize: 14,
    color: TEXT_MUTED,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  featuresGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 28,
  },
  featureCard: {
    width: '23%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0F0F5',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  featureText: {
    fontSize: 10,
    fontWeight: '600',
    color: TEXT_DARK,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 14,
  },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 10 : 20,
  },
  bottomBtn: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    minWidth: 80,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_MUTED,
  },
  nextPillBtn: {
    flexDirection: 'row',
    backgroundColor: GOLD,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  nextPillText: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_DARK,
    marginRight: 4,
  },

  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D1D1D6',
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: GOLD,
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  // ── Language Screen Styles ────────────────────────────────────────────────
  lightHeaderCard: {
    backgroundColor: BG_WHITE,
    paddingTop: 64,
    paddingBottom: 24,
    paddingHorizontal: 28,
  },
  headerTitleDark: {
    fontSize: 32,
    fontWeight: '800',
    color: TEXT_DARK,
    lineHeight: 38,
  },
  headerSubtitleDark: {
    fontSize: 15,
    color: TEXT_MUTED,
    marginTop: 10,
    lineHeight: 20,
  },

  languageBody: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 36,
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  langList: {
    alignItems: 'center',
  },
  langCard: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D0D0D5',
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  langCardSelected: {
    borderWidth: 0,
    overflow: 'hidden',
  },
  langGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
  },
  langText: {
    fontSize: 17,
    fontWeight: '600',
    color: TEXT_DARK,
  },
  langTextSelected: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  langNextBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },

  // ── Phone Input Screen Styles ─────────────────────────────────────────────
  phoneBody: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 36,
  },
  phoneScroll: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_MUTED,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  phoneInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C7C7CC',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    backgroundColor: '#FFFFFF',
  },
  phonePrefix: {
    fontSize: 17,
    fontWeight: '600',
    color: TEXT_DARK,
    marginRight: 8,
  },
  phoneInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: TEXT_DARK,
  },

  telegramAltBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(42, 171, 238, 0.08)',
  },
  telegramAltText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2AABEE',
  },

  termsText: {
    fontSize: 14,
    color: TEXT_MUTED,
    textAlign: 'left',
    marginTop: 40,
    marginBottom: 24,
    lineHeight: 20,
  },
  termsBold: {
    fontWeight: '700',
    color: TEXT_DARK,
  },

  continueBtn: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    backgroundColor: '#E5C158',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: GOLD_DARK,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  continueBtnDisabled: {
    backgroundColor: '#EBE5D3',
    elevation: 0,
  },
  continueBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 10,
  },
});
