# RESPUESTAS

### Pregunta 1: Integración del modelo de IA para extracción y comparación de habilidades
Para integrar esta función, implementaría el siguiente flujo:
1. **Extracción:** El backend envía la carta de presentación a un modelo de lenguaje (LLM) con un prompt estructurado (usando *Structured Outputs* o JSON Mode) para extraer las habilidades técnicas en formato lista.
2. **Normalización:** Se cruzan las habilidades extraídas contra el catálogo oficial de la empresa para unificar términos (por ejemplo, convertir "React.js" o "ReactJS" a "React").
3. **Comparación:** Se contrasta la lista de habilidades obtenida contra las requeridas por la vacante y se calcula un porcentaje de coincidencia (*match*) junto con el detalle de las habilidades presentes y faltantes.

---

### Pregunta 2: Manejo de formatos inválidos o habilidades inexistentes en el Backend
El backend debe actuar como un filtro estricto antes de procesar o guardar la información:
1. **Validación de esquema (JSON Schema):** Si la respuesta del modelo no cumple con el formato esperado, el backend debe capturar el error y reintentar la solicitud al modelo con una penalización o temperatura más baja.
2. **Mapeo y filtrado contra catálogo:** Las habilidades devueltas se validan contra la base de datos de la empresa. Si una habilidad no existe en el catálogo, se puede ignorar, enviar a un flujo de revisión manual o mapear automáticamente mediante búsqueda por similitud (*embeddings*).
3. **Fallback Graceful:** Si tras varios reintentos el modelo falla, el sistema no se cae; registra el log del error y permite al usuario o reclutador ingresar/editar las habilidades manualmente.

---

### Pregunta 3: Reemplazo de reglas determinísticas por decisiones de IA
**No es apropiado reemplazar completamente las reglas determinísticas por IA**, especialmente cuando la decisión afecta directamente a las personas (procesos de selección, contratación, scoring, etc.). 

**Justificación técnica y ética:**
* **Determinismo y Explicabilidad:** Las reglas de negocio garantizan que a los mismos insumos siempre corresponda el mismo resultado, haciendo el proceso auditable y transparente.
* **Sesgo y Alucinaciones:** Los modelos de IA pueden introducir sesgos implícitos o generar respuestas impredecibles ("alucinaciones"), lo que podría derivar en discriminación o decisiones injustas sin justificación clara.
* **Enfoque Híbrido (Recomendado):** La IA debe utilizarse únicamente como una herramienta de apoyo (para extraer, resumir o sugerir un puntaje inicial), pero la decisión final de prioridad o selección debe estar regida por reglas de negocio claras e inmutables, manteniendo siempre la supervisión humana (*Human-in-the-loop*).