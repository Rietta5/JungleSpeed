import React, { useEffect, useState, useRef } from 'react';
// import './App.css';

// Mapeo de número a color
const colorMap: Record<string, string> = {
  '1': 'naranja',
  '2': 'amarillo',
  '3': 'morado',
  '4': 'verde',
};

// Mapeo de orientación a grados de rotación
const orientationMap: Record<string, number> = {
  '1': 0,
  '2': 90,
  '3': 180,
  '4': 270,
};

// Mapeo de posiciones en la cuadrícula (fila, columna)
const gridMap = [
  { row: 2, col: 1, player: 1 }, // (3,2) Jugador 1 (real)
  { row: 2, col: 0, player: 2 }, // (3,1) Jugador 2
  { row: 1, col: 0, player: 3 }, // (2,1) Jugador 3
  { row: 0, col: 0, player: 4 }, // (1,1) Jugador 4
  { row: 0, col: 1, player: 5 }, // (1,2) Jugador 5
  { row: 0, col: 2, player: 6 }, // (1,3) Jugador 6
  { row: 1, col: 2, player: 7 }, // (2,3) Jugador 7
  { row: 2, col: 2, player: 8 }, // (3,3) Jugador 8
];

// Utilidad para parsear una celda del CSV
function parseCard(cell: string) {
  if (!cell) return null;
  const clean = cell.replace('*', '');
  const [num, color, orientation] = clean.split('.');
  if (!num || !color || !orientation) return null;
  return { num, color, orientation };
}

// Utilidad para normalizar una carta (quita asteriscos y espacios)
function normalizeCard(card: string) {
  return card.replace(/\*/g, '').replace(/\s+/g, '');
}

interface GameResult {
  userId: string;
  language: string;
  gender: string;
  age: string;
  simulation: number;
  round: number;
  timestamp: string;
  result: 'success' | 'fail';
}

const App: React.FC = () => {
  // Estados esenciales
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [loading, setLoading] = useState(true);
  const [roundIndex, setRoundIndex] = useState(1);
  const [boardState, setBoardState] = useState<(string | null)[]>(Array(8).fill(null));
  const [matchResult, setMatchResult] = useState<null | 'success' | 'fail'>(null);
  const [matchedPlayers, setMatchedPlayers] = useState<number[]>([]);
  const [covered, setCovered] = useState<{ [player: number]: string }>({});
  const [results, setResults] = useState<GameResult[]>([]);
  const userIdRef = useRef<string>('');
  const [gameStarted, setGameStarted] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);

  // Estados para múltiples simulaciones
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const processingEndRef = useRef(false);

  // Estados para la selección de idioma y demografía
  const [showLanguageModal, setShowLanguageModal] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<'es' | 'en'>('es');
  const [showDemographicModal, setShowDemographicModal] = useState(false);
  const [userGender, setUserGender] = useState<string>('');
  const [userAgeRange, setUserAgeRange] = useState<string>('');
  const [showExplanationModal, setShowExplanationModal] = useState(false);

  // Estados para datos demográficos
  const [selectedSimulation, setSelectedSimulation] = useState(1);
  const [simulationCount, setSimulationCount] = useState(0);
  const [usedSimulations, setUsedSimulations] = useState<number[]>([]);

  // Función para seleccionar aleatoriamente una simulación no usada
  const selectRandomSimulation = () => {
    const availableSimulations = [1, 2, 3, 4, 5, 6].filter(sim => !usedSimulations.includes(sim));
    
    if (availableSimulations.length === 0) {
      // Si todas las simulaciones han sido usadas, resetear
      setUsedSimulations([]);
      return Math.floor(Math.random() * 6) + 1;
    }
    
    const randomIndex = Math.floor(Math.random() * availableSimulations.length);
    const selectedSim = availableSimulations[randomIndex];
    
    setUsedSimulations(prev => [...prev, selectedSim]);
    return selectedSim;
  };

  // Función para cargar datos de simulación
  const loadSimulationData = async (simulationNumber: number) => {
    try {
      const response = await fetch(`/jungle_speed_simulacion_${simulationNumber}.csv`);
      const csvText = await response.text();
      const lines = csvText.split('\n').filter(line => line.trim() !== '');
      // El formato clásico: cada línea es una ronda, separada por ';'
      // La primera línea suele ser cabecera, así que la ignoramos
      const data = lines.slice(1).map(line => line.split(';'));
      setCsvData(data);
      setSelectedSimulation(simulationNumber);
      // No resetear aquí, ya se hace en handleNextSimulation
      setLoading(false);
      setGameStarted(true);
    } catch (error) {
      console.error('Error loading simulation data:', error);
    }
  };

  // Al iniciar el juego, cargar la simulación actual
  const handleStartGame = () => {
    setShowExplanationModal(false);
    setGameCompleted(false); // Resetear al iniciar nuevo juego
    setLoading(true);
    setSimulationCount(0);
    setUsedSimulations([]);
    loadSimulationData(selectRandomSimulation());
  };

  // Cargar siguiente simulación
  const handleNextSimulation = () => {
    setShowTransitionModal(false);
    setLoading(true);
    // Resetear todos los estados del juego para la nueva simulación
    setRoundIndex(1);
    setBoardState(Array(8).fill(null));
    setCovered({});
    setMatchResult(null);
    setMatchedPlayers([]);
    setGameStarted(false);
    processingEndRef.current = false;
    loadSimulationData(selectRandomSimulation());
  };

  // Avance automático de rondas
  useEffect(() => {
    if (!gameStarted || loading || csvData.length <= 1 || processingEndRef.current) return;
    
    // Velocidad progresiva según la simulación
    let intervalTime: number;
    if (simulationCount === 0) {
      intervalTime = 750; // Primera simulación: 0.75 segundos
    } else if (simulationCount === 1) {
      intervalTime = 500; // Segunda simulación: 0.5 segundos
    } else {
      intervalTime = 250; // Tercera simulación: 0.25 segundos
    }
    
    const interval = setInterval(() => {
      setRoundIndex(prev => {
        if (prev < csvData.length) {
          return prev + 1;
        } else {
          if (processingEndRef.current) {
            return prev;
          }
          
          console.log('=== FIN DE SIMULACIÓN ===');
          console.log('selectedSimulation:', selectedSimulation);
          
          processingEndRef.current = true;
          setGameStarted(false);
          
          if (simulationCount < 2) {
            console.log('Mostrando modal de transición');
            setSimulationCount(prev => prev + 1);
            setShowTransitionModal(true);
          } else {
            console.log('Activando gameCompleted para simulación', selectedSimulation);
            setGameCompleted(true);
          }
          return prev;
        }
      });
    }, intervalTime);
    return () => clearInterval(interval);
  }, [gameStarted, loading, csvData.length, simulationCount]);

  // Resetear la bandera cuando cambia la simulación
  useEffect(() => {
    processingEndRef.current = false;
  }, [selectedSimulation]);

  // Log cuando cambia gameCompleted
  useEffect(() => {
    if (gameCompleted) {
      console.log('gameCompleted se activó correctamente');
    }
  }, [gameCompleted]);

  // Estado acumulativo del tablero y destape automático
  useEffect(() => {
    if (loading || csvData.length <= 1) return;
    setBoardState(prevState => {
      const newState = [...prevState];
      // Ajustar el índice: roundIndex empieza en 1, pero csvData empieza en 0
      const round = csvData[roundIndex - 1];
      if (!round) return newState;
      setCovered(prevCovered => {
        const updated = { ...prevCovered };
        Object.entries(prevCovered).forEach(([playerStr, coveredCard]) => {
          const player = Number(playerStr);
          const newCard = round[player];
          if (
            (newCard && newCard.trim() !== '' &&
              normalizeCard(newCard) !== normalizeCard(coveredCard)) ||
            (coveredCard === undefined && newCard && newCard.trim() !== '')
          ) {
            updated[player] = undefined;
            delete updated[player];
          }
        });
        return updated;
      });
      // Los jugadores están en round[1] a round[8] (round[0] suele ser cabecera o número de ronda)
      for (let i = 1; i <= 8; i++) {
        if (round[i] && typeof round[i] === 'string' && round[i].trim() !== '') {
          newState[i - 1] = round[i];
        }
      }
      return newState;
    });
  }, [roundIndex, csvData, loading]);

  // Generar o recuperar userId único
  useEffect(() => {
    let userId = localStorage.getItem('jungle_speed_user_id');
    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem('jungle_speed_user_id', userId);
    }
    userIdRef.current = userId;
    const saved = localStorage.getItem('jungle_speed_results');
    if (saved) {
      setResults(JSON.parse(saved));
    }
  }, []);

  // Guardar resultados en localStorage
  useEffect(() => {
    localStorage.setItem('jungle_speed_results', JSON.stringify(results));
  }, [results]);

  // Lógica de coincidencia al pulsar espacio
  useEffect(() => {
    const handleSpace = (e: KeyboardEvent) => {
      if (e.code === 'Space' && matchResult === null) {
        const realCard = parseCard(boardState[0] || '');
        if (!realCard || !realCard.num) return;
        let found = false;
        let matches: number[] = [];
        for (let i = 1; i < 8; i++) {
          if (covered[i + 1]) continue;
          const otherCard = parseCard(boardState[i] || '');
          if (otherCard && otherCard.num === realCard.num) {
            found = true;
            matches.push(i + 1);
          }
        }
        
        setResults(prev => [
          ...prev,
          {
            userId: userIdRef.current,
            language: selectedLanguage,
            gender: userGender,
            age: userAgeRange,
            simulation: selectedSimulation,
            round: roundIndex,
            timestamp: new Date().toISOString(),
            result: found ? 'success' : 'fail',
          },
        ]);
        
        if (found) {
          setMatchResult('success');
          setMatchedPlayers([1, ...matches]);
          setCovered(prev => {
            const updated = { ...prev };
            matches.forEach(player => {
              if (player !== 1) {
                updated[player] = normalizeCard(boardState[player - 1] || '');
              }
            });
            return updated;
          });
        } else {
          setMatchResult('fail');
          setMatchedPlayers([1]);
        }
        setTimeout(() => {
          setMatchResult(null);
          setMatchedPlayers([]);
        }, 750);
      }
    };
    window.addEventListener('keydown', handleSpace);
    return () => window.removeEventListener('keydown', handleSpace);
  }, [boardState, matchResult, roundIndex, covered]);

  // Función para exportar resultados a CSV
  function exportResultsToCSV() {
    // Solo incluir resultados de juego (success/fail), no los 'end'
    const gameResults = results.filter(r => r.result === 'success' || r.result === 'fail');
    const header = 'userId,language,gender,age,simulation,round,timestamp,result\n';
    const rows = gameResults.map(r => `${r.userId},${r.language},${r.gender},${r.age},${r.simulation},${r.round},${r.timestamp},${r.result}`).join('\n');
    const csv = header + rows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jungle_speed_resultados.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Modal de agradecimiento final - PRIORIDAD ABSOLUTA
  if (gameCompleted) {
    console.log('Renderizando modal de agradecimiento final');
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50">
        <div className="bg-white bg-opacity-80 absolute inset-0"></div>
        <button
          className="absolute top-4 right-4 px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition z-30"
          onClick={exportResultsToCSV}
        >
          Descargar resultados CSV
        </button>
        <div className="relative bg-[#FF746C] text-black p-8 rounded-lg z-10 flex flex-col items-center">
          <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'TikiTropic, Arial, sans-serif' }}>{selectedLanguage === 'es' ? '¡Gracias por jugar!' : 'Thank you for playing!'}</h2>
        </div>
      </div>
    );
  }

  // Ventana emergente de selección de idioma
  if (showLanguageModal) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
        <div className="bg-[#FF746C] rounded-lg p-8 max-w-md w-full mx-4 text-center">
          <h2 className="text-2xl font-bold mb-6 text-black" style={{ fontFamily: 'TikiTropic, Arial, sans-serif' }}>
            Elige tu idioma
          </h2>
          
          <div className="flex justify-center space-x-8 mb-6">
            <button
              onClick={() => {
                setSelectedLanguage('es');
                setShowLanguageModal(false);
                setShowDemographicModal(true);
              }}
              className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <img 
                src="/esp.png" 
                alt="Bandera de España" 
                className="w-20 h-14 mb-2 object-cover rounded shadow-md"
              />
              <span className="text-sm font-medium text-black" style={{ fontFamily: 'TikiTropic, Arial, sans-serif' }}>Español</span>
            </button>
            
            <button
              onClick={() => {
                setSelectedLanguage('en');
                setShowLanguageModal(false);
                setShowDemographicModal(true);
              }}
              className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <img 
                src="/ing.svg" 
                alt="Bandera del Reino Unido" 
                className="w-20 h-14 mb-2 object-cover rounded shadow-md"
              />
              <span className="text-sm font-medium text-black" style={{ fontFamily: 'TikiTropic, Arial, sans-serif' }}>English</span>
            </button>
          </div>
          
          <p className="text-lg font-semibold text-black" style={{ fontFamily: 'TikiTropic, Arial, sans-serif' }}>
            Choose your language
          </p>
        </div>
      </div>
    );
  }

  // Ventana emergente de información demográfica
  if (showDemographicModal) {
    const texts = {
      es: {
        title: 'Información demográfica',
        gender: 'Género',
        age: 'Rango de edad',
        continue: 'Continuar',
        genderOptions: ['Femenino', 'Masculino', 'Otro', 'Prefiero no decirlo'],
        ageOptions: ['10-19', '20-29', '30-39', '40-49', '50-59', '60+ años']
      },
      en: {
        title: 'Demographic information',
        gender: 'Gender',
        age: 'Age range',
        continue: 'Continue',
        genderOptions: ['Female', 'Male', 'Other', 'Prefer not to say'],
        ageOptions: ['10-19', '20-29', '30-39', '40-49', '50-59', '60+ years']
      }
    };
    const currentTexts = texts[selectedLanguage];
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
        <div className="bg-[#FF746C] rounded-lg p-8 max-w-md w-full mx-4 text-center">
          <h2 className="text-2xl font-bold mb-6 text-black" style={{ fontFamily: 'TikiTropic, Arial, sans-serif' }}>
            {currentTexts.title}
          </h2>
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 text-black" style={{ fontFamily: 'TikiTropic, Arial, sans-serif' }}>
              {currentTexts.gender}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {currentTexts.genderOptions.map(option => (
                <button
                  key={option}
                  onClick={() => setUserGender(option)}
                  className={`p-3 rounded-lg border-2 transition-colors ${
                    userGender === option
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400 text-black'
                  }`}
                  style={{ fontFamily: 'TikiTropic, Arial, sans-serif' }}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 text-black" style={{ fontFamily: 'TikiTropic, Arial, sans-serif' }}>
              {currentTexts.age}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {currentTexts.ageOptions.map(option => (
                <button
                  key={option}
                  onClick={() => setUserAgeRange(option)}
                  className={`p-3 rounded-lg border-2 transition-colors ${
                    userAgeRange === option
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400 text-black'
                  }`}
                  style={{ fontFamily: 'TikiTropic, Arial, sans-serif' }}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => {
              setShowDemographicModal(false);
              setShowExplanationModal(true);
            }}
            disabled={!userGender || !userAgeRange}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              userGender && userAgeRange
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            style={{ fontFamily: 'TikiTropic, Arial, sans-serif' }}
          >
            {currentTexts.continue}
          </button>
        </div>
      </div>
    );
  }

  // Ventana de explicación del juego
  if (showExplanationModal) {
    const texts = {
      es: {
        title: 'Explicación del juego',
        start: 'Empezar',
      },
      en: {
        title: 'Game explanation',
        start: 'Start',
      }
    };
    const currentTexts = texts[selectedLanguage];
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
        <div className="bg-[#FF746C] rounded-lg p-8 max-w-md w-full mx-4 text-center">
          <h2 className="text-2xl font-bold mb-8 text-black" style={{ fontFamily: 'TikiTropic, Arial, sans-serif' }}>
            {currentTexts.title}
          </h2>
          <button
            className="w-full py-4 mt-8 text-2xl rounded-lg font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            style={{ fontFamily: 'TikiTropic, Arial, sans-serif' }}
            onClick={handleStartGame}
          >
            {currentTexts.start}
          </button>
        </div>
      </div>
    );
  }

  // Modal de transición entre simulaciones
  if (showTransitionModal) {
    const texts = {
      es: {
        title: simulationCount === 1 ? 'Primera simulación completada' : 'Segunda simulación completada',
        message: simulationCount === 1 
          ? `¡Bien hecho! Has completado la simulación ${selectedSimulation}. Ahora vamos con la segunda simulación.`
          : `¡Excelente! Has completado la simulación ${selectedSimulation}. Ahora vamos con la tercera simulación.`,
        continue: 'Continuar',
      },
      en: {
        title: simulationCount === 1 ? 'First simulation completed' : 'Second simulation completed',
        message: simulationCount === 1 
          ? `Well done! You completed simulation ${selectedSimulation}. Now let's go with the second simulation.`
          : `Excellent! You completed simulation ${selectedSimulation}. Now let's go with the third simulation.`,
        continue: 'Continue',
      }
    };
    const currentTexts = texts[selectedLanguage];
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
        <div className="bg-[#FF746C] rounded-lg p-8 max-w-md w-full mx-4 text-center">
          <h2 className="text-2xl font-bold mb-4 text-black" style={{ fontFamily: 'TikiTropic, Arial, sans-serif' }}>
            {currentTexts.title}
          </h2>
          <p className="text-lg mb-6 text-black" style={{ fontFamily: 'TikiTropic, Arial, sans-serif' }}>
            {currentTexts.message}
          </p>
          <button
            className="w-full py-4 text-xl rounded-lg font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            style={{ fontFamily: 'TikiTropic, Arial, sans-serif' }}
            onClick={handleNextSimulation}
          >
            {currentTexts.continue}
          </button>
        </div>
      </div>
    );
  }

  // Mostrar el tablero SOLO si gameStarted es true
  if (!gameStarted) return null;

  if (loading) return <div className="p-8 text-center">Cargando...</div>;

  // Construir la cuadrícula 3x3
  const grid: (JSX.Element | null)[][] = Array.from({ length: 3 }, () => Array(3).fill(null));

  // Determinar el jugador activo secuencialmente según la ronda
  const highlightedPlayer = ((roundIndex - 1) % 8) + 1;

  gridMap.forEach(({ row, col, player }) => {
    const cell = boardState[player - 1] || '';
    const card = parseCard(cell);
    let borderClass = '';
    if (matchedPlayers.includes(player)) {
      borderClass = matchResult === 'success' ? 'border-4 border-green-500' : 'border-4 border-red-500';
    }
    if (player === highlightedPlayer) {
      borderClass += ' border-4 border-gray-400';
    }
    const baseClass = borderClass.trim() ? `flex items-center justify-center w-48 h-48 bg-white ${borderClass}` : 'flex items-center justify-center w-48 h-48';
    
    if (player !== 1 && covered[player]) {
      grid[row][col] = (
        <div key={player} className={baseClass}>
          <img src={"/JungleSVG/Reverso_Jungle_Speed.svg"} alt="Reverso" className="max-w-full max-h-full" />
        </div>
      );
    } else if (card && card.num && card.color) {
      const svgName = `${card.num} ${colorMap[card.color]}.svg`;
      const rotation = orientationMap[card.orientation] || 0;
      grid[row][col] = (
        <div key={player} className={baseClass} style={{ transform: `rotate(${rotation}deg)` }}>
          <img src={`/JungleSVG/${svgName}`} alt={svgName} className="max-w-full max-h-full" />
        </div>
      );
    } else {
      grid[row][col] = <div key={player} className={baseClass} />;
    }
  });

  // Centro vacío
  grid[1][1] = <div key="center" className="w-48 h-48" />;

  // Flecha SVG apuntando hacia arriba a la casilla (3,2)
  const arrow = (
    <svg width="60" height="60" viewBox="0 0 60 60" className="absolute left-1/2 top-full -translate-x-1/2 mt-2 z-10" style={{ pointerEvents: 'none' }}>
      <polygon points="30,0 50,40 40,40 40,60 20,60 20,40 10,40" fill="#f59e42" stroke="#b45309" strokeWidth="3" />
    </svg>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white relative">
      <button
        className="absolute top-4 right-4 px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition z-30"
        onClick={exportResultsToCSV}
      >
        Descargar resultados CSV
      </button>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-600 text-lg font-semibold z-20 pointer-events-none select-none">
        {selectedLanguage === 'es' ? 'Ronda' : 'Round'} {roundIndex}
      </div>
      <h1 className="text-5xl font-bold mb-8 mt-8" style={{ fontFamily: 'TikiTropic, Arial, sans-serif' }}>
        Jungle Speed
      </h1>
      <div className="relative">
        {(matchResult === 'success' || matchResult === 'fail') && (
          <div
            className="absolute"
            style={{
              left: '50%',
              top: 'calc(100% - 200px)',
              transform: 'translate(-50%, -100%)',
              zIndex: 30,
            }}
          >
            <span className={`text-3xl font-bold ${matchResult === 'success' ? 'text-green-700' : 'text-red-700'}`}>
              {matchResult === 'success' 
                ? (selectedLanguage === 'es' ? '¡Correcto!' : 'Correct!')
                : (selectedLanguage === 'es' ? '¡Incorrecto!' : 'Incorrect!')
              }
            </span>
          </div>
        )}
        <div className="grid grid-cols-3 gap-x-12 gap-y-12">
          {grid.flat()}
        </div>
        {arrow}
      </div>
    </div>
  );
};

export default App; 