import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
/** Reanimated initial preference plus live OS updates while the application is open. */
const MotionPreference = createContext(false);
export const useMotionPreference = () => useContext(MotionPreference);
export function MotionPreferenceProvider({ children }: PropsWithChildren) {
  const initial = useReducedMotion() ?? false;
  const [reduced, setReduced] = useState(initial);
  useEffect(() => {
    let active = true;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduced(value); }).catch(() => {});
    return () => { active = false; subscription.remove(); };
  }, []);
  return <MotionPreference.Provider value={reduced}>{children}</MotionPreference.Provider>;
}
