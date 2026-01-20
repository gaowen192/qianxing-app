import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Platform, FlatList } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../App';

// 搜索建议类型定义
type SearchSuggestion = {
  id: string;
  name: string;
  address?: string;
  district?: string;
  location?: {
    lat: number;
    lng: number;
  };
};

// 选中位置类型定义
type SelectedLocation = {
  latitude: number;
  longitude: number;
  address: string;
};

// 获取对应平台的高德地图API Key
const getAmapKey = () => {
  switch (Platform.OS) {
    case 'android':
      return 'bc12c1b45b01f0430d4ef6f758e352cd';
    case 'ios':
      return '2ba9993681415fc4d93a98bf2a3ef247';
    case 'web':
      return 'f8d0d162d08a70ca1f8916ca5c6b0887';
    default:
      return 'f8d0d162d08a70ca1f8916ca5c6b0887';
  }
};

export default function LocationSelectScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'LocationSelect'>>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const webViewRef = React.useRef<WebView>(null);
  
  // 接收传递的参数
  const { type } = route.params || { type: 'destination' };
  
  const [searchText, setSearchText] = useState('');
  const [location, setLocation] = useState({ longitude: 116.397428, latitude: 39.90923 });
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [currentCity, setCurrentCity] = useState('');

  // 地图配置 - WebView加载的是高德地图Web API，所以始终使用Web平台的Key
  const mapConfig = {
    apiKey: 'f8d0d162d08a70ca1f8916ca5c6b0887', // Web平台的API Key
    coordinate: location,
    zoomLevel: 15
  };
  
  // 验证当前平台和API Key信息
  console.log('=============== Current platform:', Platform.OS);
  console.log('=============== React Native platform API Key:', getAmapKey());
  console.log('=============== WebView API Key:', mapConfig.apiKey);

  // 获取用户位置
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        
        if (status !== 'granted') {
          console.log('=============== Location permission denied');
          setIsLoading(false);
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        });
        
        const { latitude, longitude } = currentLocation.coords;
        setLocation({ latitude, longitude });
        console.log('=============== User location obtained:', { latitude, longitude });
        
        // 获取当前城市
        await fetchCurrentCity(latitude, longitude);
      } catch (error) {
        console.error('=============== Error getting location:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // 组件卸载时清除定时器
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  // 处理地图点击事件和搜索结果
  const handleMapMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'mapClick') {
        setSelectedLocation({
          latitude: data.latitude,
          longitude: data.longitude,
          address: data.address
        });
        setSearchText(data.address || `位置坐标: ${data.latitude}, ${data.longitude}`);
        setSearchSuggestions([]); // 清空搜索建议
      } else if (data.type === 'searchResults') {
        console.log('=============== Search results:', data.results || []);
        setSearchSuggestions(data.results || []);
        setIsSearching(false);
      } else if (data.type === 'log') {
        // 打印来自WebView的日志
        console.log(data.message);
      } else if (data.type === 'mapReady') {
        console.log('=============== Map is ready for operations');
      }
    } catch (error: any) {
      console.error('=============== Error parsing map message:', error);
    }
  };

  // 调用WebView中的搜索函数
  const handleSearch = (keyword: string) => {
    console.log('=============== Search request:', keyword);
    console.log('=============== Using AMap URL API instead of WebView');
    console.log('=============== Search using API Key:', mapConfig.apiKey);
    
    if (keyword.trim()) {
      setIsSearching(true);
      fetchAmapSearch(keyword);
    } else {
      setSearchSuggestions([]);
      setIsSearching(false);
    }
  };

  // 直接调用高德地图URL搜索API
  const fetchAmapSearch = async (keyword: string) => {
    try {
      console.log('=============== AMap URL API search request:', keyword);
      const webApiKey = mapConfig.apiKey;
      console.log('=============== Using Web API Key:', webApiKey);
      
      if (!keyword || keyword.trim() === '') {
        console.log('=============== Search skipped: Empty keyword');
        setSearchSuggestions([]);
        setIsSearching(false);
        return;
      }

      // 构建请求URL - 使用高德地图地点搜索API
      const apiUrl = `https://restapi.amap.com/v3/place/text?key=${webApiKey}&keywords=${encodeURIComponent(keyword)}&types=&city=${encodeURIComponent(currentCity || '')}&children=1&offset=20&page=1&extensions=base`;
      
      console.log('=============== API request URL:', apiUrl);
      console.log('=============== Current city:', currentCity);
      
      // 发送请求
      const response = await fetch(apiUrl);
      console.log('=============== API response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`API request failed with status: ${response.status}`);
      }

      const data = await response.json();
      console.log('=============== API response data:', data);
      
      if (data.status === '1') {
        // 处理搜索结果
        const formattedResults = data.pois.map((poi: any) => {
          const location = poi.location ? poi.location.split(',') : [];
          return {
            id: poi.id || '',
            name: poi.name || '',
            address: poi.address || '',
            district: poi.district || '',
            location: location.length === 2 ? {
              lng: parseFloat(location[0]),
              lat: parseFloat(location[1])
            } : null
          };
        });
        
        console.log('=============== Formatted search results:', formattedResults);
        setSearchSuggestions(formattedResults);
      } else {
        console.log('=============== API error:', data.info);
        setSearchSuggestions([]);
      }
    } catch (error: any) {
      console.error('=============== Fetch search error:', error);
      setSearchSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  };

  // 获取当前城市
  const fetchCurrentCity = async (latitude: number, longitude: number) => {
    try {
      console.log('=============== Fetching current city:', { latitude, longitude });
      const webApiKey = mapConfig.apiKey;
      
      // 构建逆地理编码API请求URL
      const apiUrl = `https://restapi.amap.com/v3/geocode/regeo?key=${webApiKey}&location=${longitude},${latitude}&extensions=base`;
      
      console.log('=============== Reverse geocoding API URL:', apiUrl);
      
      // 发送请求
      const response = await fetch(apiUrl);
      console.log('=============== Reverse geocoding API response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Reverse geocoding API request failed with status: ${response.status}`);
      }

      const data = await response.json();
      console.log('=============== Reverse geocoding API response data:', data);
      
      if (data.status === '1' && data.regeocode) {
        // 提取城市信息
        const city = data.regeocode.addressComponent.city || 
                     data.regeocode.addressComponent.province || '';
        setCurrentCity(city);
        console.log('=============== Current city obtained:', city);
      } else {
        console.log('=============== Reverse geocoding API error:', data.info);
      }
    } catch (error: any) {
      console.error('=============== Fetch current city error:', error);
    }
  };

  // 带数据的确认选择函数
  const handleConfirmWithData = (locationData: any, addressText: string) => {
    console.log('=============== handleConfirmWithData called');
    console.log('=============== locationData:', locationData);
    console.log('=============== addressText:', addressText);
    console.log('=============== route.params:', route.params);
    
    // 构建返回参数
    const returnParams = {
      selectedDestination: {
        text: addressText,
        address: addressText,
        latitude: locationData.latitude,
        longitude: locationData.longitude
      },
      type: route.params?.type || 'destination',
      index: route.params?.index
    };
    
    console.log('=============== Returning with params:', returnParams);
    
    // 调用回调函数传递参数
    if (route.params?.onSelect) {
      console.log('=============== Calling onSelect callback');
      route.params.onSelect(returnParams);
    }
    
    // 直接返回上一页
    console.log('=============== Going back to previous screen');
    navigation.goBack();
  };

  // 处理搜索建议项点击事件
  const handleSuggestionPress = (suggestion: SearchSuggestion) => {
    console.log('=============== Search suggestion pressed:', suggestion);
    if (suggestion) {
      // 构建完整地址
      const fullAddress = suggestion.address 
        ? `${suggestion.district || ''} ${suggestion.address}`.trim() 
        : suggestion.name;
      
      console.log('=============== Full address constructed:', fullAddress);
      
      // 更新搜索文本
      console.log('=============== Setting searchText:', fullAddress);
      setSearchText(fullAddress);
      
      // 更新选中位置
      const newSelectedLocation = {
        latitude: suggestion.location?.lat || location.latitude,
        longitude: suggestion.location?.lng || location.longitude,
        address: fullAddress
      };
      console.log('=============== Setting selectedLocation:', newSelectedLocation);
      setSelectedLocation(newSelectedLocation);
      
      // 清空搜索建议列表
      setSearchSuggestions([]);
      
      // 直接使用新数据调用确认函数，避免状态更新异步问题
      console.log('=============== Calling handleConfirm with new data');
      handleConfirmWithData(newSelectedLocation, fullAddress);
    }
  };

  // 确认选择
  const handleConfirm = () => {
    console.log('=============== handleConfirm called');
    console.log('=============== selectedLocation:', selectedLocation);
    console.log('=============== searchText:', searchText);
    console.log('=============== route.params:', route.params);
    
    if (selectedLocation || searchText) {
      // 构建返回参数
      const returnParams = {
        selectedDestination: {
          text: searchText || selectedLocation?.address || '',
          address: searchText || selectedLocation?.address || '',
          latitude: selectedLocation?.latitude || location.latitude,
          longitude: selectedLocation?.longitude || location.longitude
        },
        type: route.params?.type || 'destination',
        index: route.params?.index
      };
      
      console.log('=============== Returning with params:', returnParams);
      
      // 调用回调函数传递参数
      if (route.params?.onSelect) {
        console.log('=============== Calling onSelect callback');
        route.params.onSelect(returnParams);
      }
      
      // 直接返回上一页
      console.log('=============== Going back to previous screen');
      navigation.goBack();
    } else {
      console.log('=============== No location selected, going back');
      navigation.goBack();
    }
  };

  // 渲染地图
  const renderMap = () => {
    const mapHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
          <title>高德地图</title>
          <style type="text/css">
            html, body, #container {
              width: 100%;
              height: 100%;
              margin: 0;
              padding: 0;
            }
          </style>
          <!-- 加载高德地图JS SDK v2.0 -->
          <script type="text/javascript" src="https://webapi.amap.com/maps?v=2.0&key=${mapConfig.apiKey}"></script>
          <!-- 加载UI组件库 -->
          <script type="text/javascript" src="https://webapi.amap.com/ui/1.1/main.js"></script>
        </head>
        <body>
          <div id="container"></div>
          <script type="text/javascript">
            window.onload = function() {
              try {
                var map = new AMap.Map('container', {
                  center: [${mapConfig.coordinate.longitude}, ${mapConfig.coordinate.latitude}],
                  zoom: ${mapConfig.zoomLevel}
                });
                
                // 添加标记
                var marker = new AMap.Marker({
                  position: [${mapConfig.coordinate.longitude}, ${mapConfig.coordinate.latitude}],
                  draggable: true
                });
                map.add(marker);
                
                // 地图点击事件
                map.on('click', function(e) {
                  var lnglat = e.lnglat;
                  marker.setPosition(lnglat);
                  
                  // 动态加载 Geocoder 插件进行地理编码
                  AMap.plugin('AMap.Geocoder', function() {
                    try {
                      var geocoder = new AMap.Geocoder({
                        radius: 1000,
                        extensions: "all"
                      });
                      
                      geocoder.getAddress(lnglat, function(status, result) {
                        if (status === 'complete' && result.regeocode) {
                          var address = result.regeocode.formattedAddress;
                          window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'mapClick',
                            latitude: lnglat.getLat(),
                            longitude: lnglat.getLng(),
                            address: address
                          }));
                        } else {
                          window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'mapClick',
                            latitude: lnglat.getLat(),
                            longitude: lnglat.getLng(),
                            address: ''
                          }));
                        }
                      });
                    } catch (geocoderError) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'log',
                        message: '=============== WebView Geocoder error: ' + geocoderError.message
                      }));
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'mapClick',
                        latitude: lnglat.getLat(),
                        longitude: lnglat.getLng(),
                        address: ''
                      }));
                    }
                  });
                });
                
                // 标记拖拽结束事件
                marker.on('dragend', function(e) {
                  var lnglat = e.lnglat;
                  
                  // 动态加载 Geocoder 插件进行地理编码
                  AMap.plugin('AMap.Geocoder', function() {
                    try {
                      var geocoder = new AMap.Geocoder({
                        radius: 1000,
                        extensions: "all"
                      });
                      
                      geocoder.getAddress(lnglat, function(status, result) {
                        if (status === 'complete' && result.regeocode) {
                          var address = result.regeocode.formattedAddress;
                          window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'mapClick',
                            latitude: lnglat.getLat(),
                            longitude: lnglat.getLng(),
                            address: address
                          }));
                        } else {
                          window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'mapClick',
                            latitude: lnglat.getLat(),
                            longitude: lnglat.getLng(),
                            address: ''
                          }));
                        }
                      });
                    } catch (geocoderError) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'log',
                        message: '=============== WebView Geocoder error: ' + geocoderError.message
                      }));
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'mapClick',
                        latitude: lnglat.getLat(),
                        longitude: lnglat.getLng(),
                        address: ''
                      }));
                    }
                  });
                });
                
                // 告诉React Native地图已初始化
                console.log('=============== Web map initialized successfully');
              } catch (error) {
                console.error('=============== Web map initialization error:', error);
              }
            };
          </script>
        </body>
      </html>
    `;

    return (
      <WebView
        ref={webViewRef}
        source={{ html: mapHtml }}
        style={styles.map}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        scalesPageToFit={false}
        onMessage={handleMapMessage}
        onLoad={() => console.log('=============== WebView map loaded')}
        onError={(error) => console.error('=============== WebView map error:', error)}
      />
    );
  };

  return (
    <View style={styles.container}>
      {/* 头部 */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {type === 'current' ? '选择当前位置' : '选择目的地'}
        </Text>
        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
          <Text style={styles.confirmButtonText}>确认</Text>
        </TouchableOpacity>
      </View>

      {/* 搜索输入框和建议列表 */}
      <View style={styles.searchContainer}>
        <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={(text) => {
              setSearchText(text);
              
              // 清除之前的定时器
              if (debounceTimer) {
                clearTimeout(debounceTimer);
              }
              
              // 设置新的定时器，300ms后执行搜索
              const timer = setTimeout(() => {
                handleSearch(text);
              }, 300);
              
              setDebounceTimer(timer);
            }}
            placeholder={`请输入${type === 'current' ? '当前' : '目标'}地址或在地图上选择`}
            placeholderTextColor="#999"
            autoFocus
          />
          
          {/* 搜索建议列表 */}
          {isSearching ? (
            <View style={styles.searchLoading}>
              <Text style={styles.searchLoadingText}>搜索中...</Text>
            </View>
          ) : searchSuggestions.length > 0 ? (
            <FlatList
              data={searchSuggestions}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.suggestionItem}
                  onPress={() => handleSuggestionPress(item)}
                >
                  <View style={styles.suggestionContent}>
                    <Text style={styles.suggestionName}>{item.name}</Text>
                    <Text style={styles.suggestionAddress}>
                      {item.address ? `${item.district || ''} ${item.address}` : item.district || ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              style={styles.suggestionList}
              maxToRenderPerBatch={5}
              windowSize={10}
            />
          ) : searchText.trim() ? (
            <View style={styles.searchEmpty}>
              <Text style={styles.searchEmptyText}>没有找到匹配的地址</Text>
            </View>
          ) : null}
      </View>

      {/* 地图 */}
      <View style={styles.mapContainer}>
        {renderMap()}
      </View>

      {/* 提示信息 */}
      <View style={styles.tipContainer}>
        <Text style={styles.tipText}>点击地图选择位置，或拖拽标记调整位置</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#333',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  confirmButton: {
    padding: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#fff',
  },
  searchInput: {
    height: 48,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#333',
  },
  
  // 搜索建议列表样式
  suggestionList: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 8,
    maxHeight: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  
  suggestionItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  
  suggestionContent: {
    flex: 1,
  },
  
  suggestionName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  
  suggestionAddress: {
    fontSize: 14,
    color: '#666',
  },
  
  // 搜索加载状态
  searchLoading: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  
  searchLoadingText: {
    fontSize: 14,
    color: '#666',
  },
  
  // 搜索空状态
  searchEmpty: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  
  searchEmptyText: {
    fontSize: 14,
    color: '#666',
  },
  
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  tipContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  tipText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});