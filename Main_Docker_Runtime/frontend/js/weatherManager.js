// js/weatherManager.js
import { BackendHooks } from './api.js';

let currentWeatherEffect = null; 

export const WeatherManager = {
  async syncWeather(weatherLayer) {
    if (currentWeatherEffect) {
      currentWeatherEffect.unmount();
      currentWeatherEffect = null;
    }
    weatherLayer.innerHTML = '';

    const weatherData = await BackendHooks.fetchCurrentWeather();
    const condition = weatherData.condition || weatherData.type; 
    const params = weatherData.params || {}; 
    
    console.log(`[WeatherManager] 적용할 날씨: ${condition}`, params);

    try {
      // weatherTheme.js 파일을 동적 임포트합니다.
      const EffectsModule = await import('./weatherTheme.js');
      
      switch(condition) {
        case 'rain': currentWeatherEffect = new EffectsModule.RainEffect(weatherLayer, params); break;
        case 'night': currentWeatherEffect = new EffectsModule.NightEffect(weatherLayer, params); break;
        case 'cloudy': currentWeatherEffect = new EffectsModule.CloudyEffect(weatherLayer, params); break;
        case 'clear': 
        default: currentWeatherEffect = new EffectsModule.ClearEffect(weatherLayer); break;
      }

      currentWeatherEffect.mount();
    } catch (err) {
      console.error("날씨 모듈 로드 실패:", err);
    }
  },

  clear(weatherLayer) {
    if (currentWeatherEffect) {
      currentWeatherEffect.unmount();
      currentWeatherEffect = null;
    }
    weatherLayer.innerHTML = '';
  }
};