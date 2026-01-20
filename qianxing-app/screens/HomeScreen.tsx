import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Platform, Text, ActivityIndicator, TextInput, TouchableOpacity, Image } from 'react-native';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Main'>;


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

export default function HomeScreen() {
  // 获取安全区域距离
  const insets = useSafeAreaInsets();
  
  // 导航属性
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const route = useRoute<any>();
  
  // 状态管理
  const [location, setLocation] = useState({ longitude: 116.397428, latitude: 39.90923 });
  const [locationPermission, setLocationPermission] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // 途经点类型定义
type Waypoint = {
  id: number;
  text: string;
};

// 叫车功能状态
  const [currentLocationText, setCurrentLocationText] = useState('当前位置');
  const [destinationText, setDestinationText] = useState('');
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);

  // 处理输入框点击事件
  const handleInputPress = (type: 'current' | 'destination' | 'waypoint', index?: number) => {
    navigation.navigate('LocationSelect', { 
      type, 
      index,
      onSelect: (params) => {
        console.log('=============== Received params from LocationSelect:', params);
        const { selectedDestination, type, index } = params;
        const addressToDisplay = selectedDestination.address || selectedDestination.text;
        
        if (type === 'current') {
          console.log('=============== Updating current location:', addressToDisplay);
          setCurrentLocationText(addressToDisplay);
        } else if (type === 'destination') {
          console.log('=============== Updating destination:', addressToDisplay);
          setDestinationText(addressToDisplay);
        } else if (type === 'waypoint' && index !== undefined) {
          console.log('=============== Updating waypoint at index:', index, 'with address:', addressToDisplay);
          setWaypoints(prevWaypoints => {
            const updatedWaypoints = [...prevWaypoints];
            // 确保索引存在，如果不存在则添加新的途经点
            if (updatedWaypoints[index]) {
              updatedWaypoints[index].text = addressToDisplay;
            } else {
              // 如果途经点不存在，创建一个新的
              updatedWaypoints[index] = {
                id: index + 1,
                text: addressToDisplay
              };
            }
            console.log('=============== Waypoints updated:', updatedWaypoints);
            return updatedWaypoints;
          });
        }
      }
    });
  };

  // 监听屏幕焦点变化，获取从LocationSelectScreen返回的结果
  useFocusEffect(
    React.useCallback(() => {
      console.log('=============== HomeScreen focus effect triggered');
      
      // 简化版本：只处理回调可能未触发的情况
      console.log('=============== Current route params:', route.params);
      
      // 检查当前路由参数
      if (route.params && route.params.selectedDestination) {
        console.log('=============== Found params in route params:', route.params);
        
        const { selectedDestination, type, index } = route.params;
        
        // 根据不同的类型更新对应的输入框内容
        const addressToDisplay = selectedDestination.address || selectedDestination.text;
        console.log('=============== Address to display:', addressToDisplay);
        
        if (type === 'current') {
          console.log('=============== Updating current location:', addressToDisplay);
          setCurrentLocationText(addressToDisplay);
        } else if (type === 'destination') {
          console.log('=============== Updating destination:', addressToDisplay);
          setDestinationText(addressToDisplay);
        } else if (type === 'waypoint' && index !== undefined) {
          // 更新对应的途经点
          console.log('=============== Updating waypoint at index:', index, 'with address:', addressToDisplay);
          // 使用函数式更新避免依赖waypoints状态
          setWaypoints(prevWaypoints => {
            const updatedWaypoints = [...prevWaypoints];
            if (updatedWaypoints[index]) {
              updatedWaypoints[index].text = addressToDisplay;
              console.log('=============== Waypoints updated:', updatedWaypoints);
            }
            return updatedWaypoints;
          });
        }
        
        // 清除参数，避免重复处理
        console.log('=============== Clearing params from route');
        navigation.setParams({ selectedDestination: undefined, type: undefined, index: undefined });
      } else {
        console.log('=============== No params found in route params');
      }
    }, [navigation, route])
  );

  // 地图配置
  const mapConfig = {
    apiKey: getAmapKey(),
    coordinate: location,
    zoomLevel: 15 // 提高缩放级别以显示更精确的位置
  };

  // 处理中间目的地的添加，最多只能添加两个途经点
  const handleAddWaypoint = () => {
    if (waypoints.length < 2) {
      const newWaypoint = {
        id: waypoints.length + 1,
        text: ''
      };
      setWaypoints([...waypoints, newWaypoint]);
    }
  };

  // 处理中间目的地文本变化
  const handleWaypointChange = (id: number, text: string) => {
    const updatedWaypoints = waypoints.map(waypoint => 
      waypoint.id === id ? { ...waypoint, text } : waypoint
    );
    setWaypoints(updatedWaypoints);
  };

  // 处理删除途经点
  const handleDeleteWaypoint = (id: number) => {
    // 删除指定ID的途经点
    let updatedWaypoints = waypoints.filter(waypoint => waypoint.id !== id);
    
    // 重新排序途经点ID
    updatedWaypoints = updatedWaypoints.map((waypoint, index) => ({
      ...waypoint,
      id: index + 1
    }));
    
    setWaypoints(updatedWaypoints);
  };

  // 请求位置权限并获取用户位置
  useEffect(() => {
    console.log('=============== HomeScreen rendered for platform:', Platform.OS);
    
    (async () => {
      try {
        // 请求位置权限
        const { status } = await Location.requestForegroundPermissionsAsync();
        setLocationPermission(status);
        
        if (status !== 'granted') {
          console.log('=============== Location permission denied');
          setIsLoading(false);
          return;
        }

        // 获取用户当前位置
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        });
        
        const { latitude, longitude } = currentLocation.coords;
        setLocation({ latitude, longitude });
        console.log('=============== User location obtained:', { latitude, longitude });
      } catch (error) {
        console.error('=============== Error getting location:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // 渲染叫车功能UI
  const renderRideHailingUI = () => {
    // 计算底部内边距，确保与导航栏齐平
    const bottomPadding = Platform.OS === 'web' ? 20 : 40 + insets.bottom;
    
    return (
      <View style={[styles.rideHailingContainer, { paddingBottom: bottomPadding }]}>
        {/* 当前位置输入框 */}
        <TouchableOpacity 
          style={styles.inputContainer}
          onPress={() => handleInputPress('current')}
          activeOpacity={0.7}
        >
          <View style={styles.locationIconContainer}>
            <Text style={styles.locationIcon}>📍</Text>
          </View>
          <TextInput
            style={styles.input}
            value={currentLocationText}
            onChangeText={setCurrentLocationText}
            placeholder="当前位置"
            placeholderTextColor="#999"
            editable={false}
            pointerEvents="none"
          />
        </TouchableOpacity>

        {/* 中间目的地 */}
        {waypoints.map((waypoint) => (
          <View key={waypoint.id} style={styles.inputContainer}>
            <TouchableOpacity 
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
              onPress={() => handleInputPress('waypoint', waypoint.id - 1)}
              activeOpacity={0.7}
            >
              <View style={styles.locationIconContainer}>
                <Text style={styles.locationIcon}>📍</Text>
              </View>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={waypoint.text}
                onChangeText={(text) => handleWaypointChange(waypoint.id, text)}
                placeholder={`途经点 ${waypoint.id}`}
                placeholderTextColor="#999"
                editable={false}
                pointerEvents="none"
              />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={() => handleDeleteWaypoint(waypoint.id)}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Text style={styles.deleteButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* 添加中间目的地按钮 */}
        <TouchableOpacity style={styles.addWaypointButton} onPress={handleAddWaypoint}>
          <Text style={styles.addWaypointButtonText}>+ 添加途经点</Text>
        </TouchableOpacity>

        {/* 目的地输入框 */}
        <TouchableOpacity 
          style={styles.inputContainer}
          onPress={() => handleInputPress('destination')}
          activeOpacity={0.7}
        >
          <View style={styles.locationIconContainer}>
            <Text style={styles.locationIcon}>📍</Text>
          </View>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={destinationText}
            onChangeText={setDestinationText}
            placeholder="目的地"
            placeholderTextColor="#999"
            editable={false}
            pointerEvents="none"
          />
        </TouchableOpacity>

        {/* 叫车按钮 */}
        <TouchableOpacity style={styles.callButton}>
          <Text style={styles.callButtonText}>立即叫车</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // 检查位置权限状态
  const renderPermissionStatus = () => {
    if (locationPermission === 'denied') {
      return (
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>位置权限被拒绝，请在设置中允许应用访问您的位置</Text>
        </View>
      );
    }
    return null;
  };

  // 统一使用WebView渲染地图，确保跨平台兼容性
  const renderMap = () => {
    console.log('=============== Rendering WebView map for platform:', Platform.OS);
    console.log('=============== Map coordinate:', mapConfig.coordinate);
    console.log('=============== Map zoom level:', mapConfig.zoomLevel);
    console.log('=============== Using Web API key:', mapConfig.apiKey);
    
    const mapHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>高德地图</title>
          <style type="text/css">
            html, body, #container {
              width: 100%;
              height: 100%;
              margin: 0;
              padding: 0;
            }
          </style>
          <script type="text/javascript" src="https://webapi.amap.com/maps?v=1.4.15&key=${mapConfig.apiKey}"></script>
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
                  title: '当前位置'
                });
                map.add(marker);
                
                console.log('=============== Web map initialized successfully');
              } catch (error) {
                console.error('=============== Web map initialization error:', error);
              }
            };
          </script>
        </body>
      </html>
    `;

    try {
      return (
        <View style={styles.container}>
          {renderPermissionStatus()}
          <WebView
            source={{ html: mapHtml }}
            style={styles.map}
            javaScriptEnabled={true}
            onLoad={() => console.log('=============== WebView map loaded')}
            onError={(error) => console.error('=============== WebView map error:', error)}
          />
          {/* 叫车功能UI覆盖层 */}
          {renderRideHailingUI()}
        </View>
      );
    } catch (error) {
      console.error('=============== Error rendering WebView:', error);
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Failed to load map</Text>
          <Text style={styles.loadingText}>Error: {error instanceof Error ? error.message : String(error)}</Text>
        </View>
      );
    }
  };

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text style={styles.loadingText}>正在获取位置信息...</Text>
        </View>
      ) : (
        renderMap()
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  errorBox: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  errorText: {
    color: '#666',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  loadingText: {
    color: '#666',
    fontSize: 14,
    marginTop: 10,
  },
  permissionContainer: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 15,
    borderRadius: 8,
    zIndex: 1000,
  },
  permissionText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  
  // 叫车功能样式
  rideHailingContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  
  locationIconContainer: {
    marginRight: 12,
    paddingVertical: 12,
  },
  
  locationIcon: {
    fontSize: 20,
  },
  
  input: {
    height: 48,
    fontSize: 16,
    color: '#333',
  },
  
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  
  addWaypointButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    paddingVertical: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  
  addWaypointButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  
  callButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  
  callButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});