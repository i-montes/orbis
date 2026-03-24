import { Memor } from "../core/memor/src/index.js";
import { setConfig, getConfig } from "@orbis/shared";

// Ajustamos la configuración para la siembra
const currentConfig = getConfig();
setConfig({
  ...currentConfig,
  memor: {
    ...currentConfig.memor,
    autoEdgeThreshold: 0.45, // Umbral optimizado para bge-m3 en español
  }
});

const memories = [
  // CLUSTER 1: Inteligencia Artificial y Embeddings
  "Los embeddings transforman palabras en vectores numéricos en un espacio multidimensional.",
  "La similitud del coseno mide el ángulo entre dos vectores para determinar su parecido semántico.",
  "Los modelos 'Bi-Encoders' son más rápidos para búsqueda pero menos precisos que los 'Cross-Encoders'.",
  "RAG (Retrieval Augmented Generation) combina búsqueda semántica con generación de lenguaje.",
  "El algoritmo KNN (K-Nearest Neighbors) es la base de la mayoría de bases de datos vectoriales.",
  "Transformers.js permite ejecutar modelos de IA directamente en el navegador o en entornos Node/Bun.",
  "El modelo BGE-M3 destaca por su capacidad multilingüe y manejo de fragmentos largos de texto.",
  "Un espacio latente es donde la IA organiza los conceptos según su significado profundo.",
  "La normalización L2 asegura que todos los vectores tengan una longitud unitaria de 1.",
  "Las bases de datos vectoriales como sqlite-vec permiten búsqueda de similitud nativa en SQL.",

  // CLUSTER 2: Desarrollo Web y Arquitectura (Técnico)
  "TypeScript añade tipado estático a JavaScript para prevenir errores en tiempo de desarrollo.",
  "Next.js utiliza el App Router para manejar layouts complejos y Server Components.",
  "Tailwind CSS es un framework basado en utilidades que acelera el diseño de interfaces.",
  "Prisma es un ORM moderno que genera tipos automáticamente basados en el esquema de base de datos.",
  "Bun es un runtime de JavaScript extremadamente rápido que incluye un bundler y gestor de paquetes.",
  "Vercel simplifica el despliegue de aplicaciones frontend con funciones serverless integradas.",
  "El patrón Singleton asegura que una clase tenga una única instancia en toda la aplicación.",
  "Clean Architecture propone separar la lógica de negocio de los detalles de implementación.",
  "SOLID son cinco principios de diseño orientados a objetos para crear software mantenible.",
  "El Model Context Protocol (MCP) es un estándar para conectar LLMs con fuentes de datos locales.",

  // CLUSTER 3: Exploración Espacial (Historia)
  "La misión Apolo 11 llevó a los primeros humanos a la superficie de la Luna en 1969.",
  "Neil Armstrong fue el primer hombre en caminar sobre la Luna, seguido por Buzz Aldrin.",
  "El cohete Saturno V sigue siendo uno de los vehículos de lanzamiento más potentes jamás construidos.",
  "El Módulo Lunar 'Eagle' se separó del Módulo de Mando para aterrizar en el Mar de la Tranquilidad.",
  "Michael Collins permaneció en órbita lunar mientras sus compañeros descendían a la superficie.",
  "La NASA planea regresar a la Luna con el programa Artemis en los próximos años.",
  "SpaceX ha revolucionado la industria con sus cohetes Falcon 9 parcialmente reutilizables.",
  "El telescopio James Webb observa el universo en el espectro infrarrojo con una precisión inédita.",
  "Marte es el próximo gran objetivo de la exploración tripulada en el sistema solar.",
  "La Estación Espacial Internacional es un laboratorio de investigación en órbita terrestre baja.",

  // CLUSTER 4: Café y Barismo (Cultura)
  "El café de especialidad debe tener una puntuación superior a 80 puntos según la SCA.",
  "El método V60 resalta la acidez y las notas frutales del café filtrado.",
  "La molienda para un espresso debe ser muy fina, similar a la consistencia de la sal de mesa.",
  "El café tipo Geisha es conocido por sus aromas florales y su perfil de sabor complejo.",
  "La prensa francesa utiliza un método de inmersión total para extraer aceites y cuerpo.",
  "El tueste claro preserva mejor los sabores de origen del grano de café.",
  "Colombia es famosa por producir café arábigo de alta calidad lavado en montaña.",
  "La cafeína es un alcaloide que actúa como estimulante del sistema nervioso central.",
  "El arte latte requiere una microespuma de leche perfectamente texturizada.",
  "Un 'Cupping' es una cata profesional para evaluar la calidad y defectos del café.",

  // CLUSTER 5: Productividad y Notion (Personalización)
  "Notion permite crear bases de datos relacionales para organizar proyectos y tareas.",
  "El método GTD (Getting Things Done) propone liberar la mente anotando todo en un sistema.",
  "La técnica Pomodoro consiste en trabajar en bloques de 25 minutos con 5 de descanso.",
  "El 'Segundo Cerebro' es un sistema digital para almacenar y conectar ideas a largo plazo.",
  "Las plantillas de Notion pueden automatizar el seguimiento de hábitos diarios.",
  "El bloqueo de tiempo (Time Blocking) mejora el enfoque en tareas de alta prioridad.",
  "Deep Work es la capacidad de concentrarse sin distracciones en una tarea cognitivamente exigente.",
  "La revisión semanal es clave para mantener un sistema de organización actualizado.",
  "Las fórmulas en Notion permiten realizar cálculos complejos entre diferentes bases de datos.",
  "Sincronizar el calendario con la lista de tareas reduce la fricción en la toma de decisiones.",

  // CLUSTER 6: Ciberseguridad
  "El phishing es una técnica de ingeniería social para robar credenciales de acceso.",
  "El cifrado de extremo a extremo garantiza que solo el emisor y receptor lean el mensaje.",
  "Una inyección SQL ocurre cuando se filtran comandos maliciosos a través de formularios.",
  "Las llaves biométricas de seguridad son mucho más difíciles de vulnerar que las contraseñas.",
  "Zero Trust es un modelo de seguridad que no confía en nadie por defecto, incluso dentro de la red.",
  "El malware tipo ransomware cifra los archivos del usuario y exige un rescate.",
  "Un firewall actúa como una barrera entre una red interna confiable y el internet.",
  "La autenticación de dos factores (2FA) añade una capa extra de protección necesaria.",
  "Los ataques de denegación de servicio (DDoS) buscan saturar un servidor con tráfico falso.",
  "El hashing de contraseñas con sal (salt) previene ataques de tablas arcoíris.",

  // CLUSTER 7: Viajes y Geografía (Colombia)
  "Tolú y Coveñas son destinos turísticos populares en el caribe colombiano por sus aguas tranquilas.",
  "El archipiélago de San Bernardo cuenta con islas hermosas como Múcura y Tintipán.",
  "Bogotá es la capital de Colombia y se encuentra a 2600 metros sobre el nivel del mar.",
  "El Valle del Cocora es famoso por sus altísimas palmas de cera, el árbol nacional.",
  "Cartagena de Indias es una ciudad colonial amurallada declarada Patrimonio de la Humanidad.",
  "El Parque Tayrona combina selva tropical con playas vírgenes en la Sierra Nevada.",
  "Medellín es conocida como la ciudad de la eterna primavera por su clima agradable.",
  "El río de los siete colores, Caño Cristales, es considerado uno de los más bellos del mundo.",
  "La gastronomía colombiana incluye platos típicos como la bandeja paisa y el ajiaco.",
  "El Carnaval de Barranquilla es la fiesta folclórica más importante de Colombia.",

  // CLUSTER 8: Salud y Biología
  "El ADN contiene las instrucciones genéticas usadas en el desarrollo de todos los seres vivos.",
  "Las mitocondrias son consideradas las centrales energéticas de las células.",
  "El sistema inmunológico protege al cuerpo contra patógenos y enfermedades.",
  "Dormir 8 horas diarias es esencial para la consolidación de la memoria y la salud mental.",
  "El ejercicio aeróbico mejora la capacidad cardiovascular y reduce el estrés.",
  "La microbiota intestinal influye directamente en el estado de ánimo y la digestión.",
  "La dopamina es un neurotransmisor asociado con el placer y la recompensa.",
  "El cortisol es la hormona que el cuerpo libera como respuesta al estrés crónico.",
  "La hidratación constante es vital para el funcionamiento óptimo del cerebro.",
  "Los antioxidantes ayudan a combatir el daño celular provocado por los radicales libres.",

  // CLUSTER 9: Astronomía y Física
  "Los agujeros negros tienen una gravedad tan intensa que ni la luz puede escapar de ellos.",
  "La teoría de la relatividad de Einstein cambió nuestra comprensión del espacio y el tiempo.",
  "Nuestra galaxia, la Vía Láctea, contiene cientos de miles de millones de estrellas.",
  "Un año luz es la distancia que recorre la luz en el vacío durante un año terrestre.",
  "La expansión del universo fue descubierta por Edwin Hubble en la década de 1920.",
  "El Sol es una estrella de tipo espectral G2V que se encuentra a mitad de su vida.",
  "Júpiter es el planeta más grande del sistema solar y tiene una gran mancha roja.",
  "Las supernovas son explosiones estelares masivas que dispersan elementos pesados.",
  "La materia oscura constituye la mayor parte de la masa del universo pero no se puede ver.",
  "El Big Bang es el modelo cosmológico que explica el origen del universo visible.",

  // CLUSTER 10: Cocina y Gastronomía
  "La reacción de Maillard es la responsable del sabor y color marrón de la carne asada.",
  "El aceite de oliva virgen extra es la base de la dieta mediterránea saludable.",
  "Fermentar pan con masa madre mejora su digestibilidad y perfil de sabor.",
  "El umami es conocido como el quinto sabor básico, presente en el tomate y el queso.",
  "Reducir una salsa a fuego lento concentra sus sabores y mejora su textura.",
  "La técnica del vacío (sous-vide) permite cocinar alimentos a temperaturas precisas.",
  "El azafrán es la especia más cara del mundo debido a su proceso de recolección manual.",
  "Blanquear vegetales consiste en sumergirlos brevemente en agua hirviendo y luego en hielo.",
  "El chocolate negro con alto porcentaje de cacao contiene polifenoles beneficiosos.",
  "Equilibrar la acidez, la sal y el dulce es el secreto de un plato balanceado."
];

async function seed() {
  console.log("🚀 Iniciando siembra de memoria en Orbis...");
  const memor = new Memor();
  
  for (let i = 0; i < memories.length; i++) {
    process.stdout.write(`⏳ Insertando ${i + 1}/100...\r`);
    await memor.addMemory({
      content: memories[i],
      source: 'USER',
      memoryType: 'FACT'
    });
  }

  console.log("\n✅ ¡Siembra completada! 100 recuerdos insertados con auto-linking.");
  memor.close();
}

seed().catch(console.error);
