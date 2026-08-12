# 🚀 Guía de Deploy a Netlify - Dashboard USEGBE

## ✅ PASO 1: Crear cuenta en Netlify (GRATIS)

1. Ve a: **https://app.netlify.com/signup**
2. Registrate con una de estas opciones:
   - GitHub (recomendado)
   - GitLab
   - Bitbucket
   - Email

---

## 📦 PASO 2: Opción A - Deploy Directo (Más Rápido)

### **Método: Drag & Drop**

1. Ve a: **https://app.netlify.com**
2. Click en **"Add new site"** → **"Deploy manually"**
3. **ARRASTRA** la carpeta `dist/dashboards-USEGBE/browser` a la zona de drop
4. ✅ **¡LISTO!** Tu sitio estará en línea en ~30 segundos

**URL ejemplo:** `https://random-name-12345.netlify.app`

### Cambiar nombre del sitio:
1. En el dashboard, ve a **"Site settings"**
2. Click en **"Change site name"**
3. Escribe: `usegbe-dashboard` (o el que prefieras)
4. ✅ Nueva URL: `https://usegbe-dashboard.netlify.app`

---

## 🔄 PASO 3: Opción B - Deploy Automático con GitHub (Profesional)

### **Requisitos:**
- Cuenta de GitHub
- Repositorio con tu código

### **Pasos:**

#### 1. Subir código a GitHub (si aún no lo has hecho)

```bash
# En la terminal, dentro del proyecto:

# Inicializar git (si no lo has hecho)
git init

# Agregar todos los archivos
git add .

# Crear commit
git commit -m "Preparar para deploy en Netlify"

# Crear repositorio en GitHub primero (https://github.com/new)
# Luego conectarlo:
git remote add origin https://github.com/TU-USUARIO/usegbe-dashboard.git

# Subir código
git branch -M main
git push -u origin main
```

#### 2. Conectar Netlify con GitHub

1. Ve a: **https://app.netlify.com**
2. Click en **"Add new site"** → **"Import from Git"**
3. Selecciona **"GitHub"**
4. Autoriza Netlify (primera vez)
5. Selecciona tu repositorio: `usegbe-dashboard`
6. Configuración de build:
   ```
   Branch to deploy: main
   Build command: npm run build
   Publish directory: dist/dashboards-USEGBE/browser
   ```
7. Click **"Deploy site"**
8. ⏳ Espera 2-3 minutos...
9. ✅ **¡LISTO!**

### **Ventajas del deploy automático:**
- ✅ Cada vez que hagas `git push`, se actualiza automáticamente
- ✅ Preview de cada Pull Request
- ✅ Historial de deploys
- ✅ Rollback fácil a versiones anteriores

---

## 🌐 PASO 4: Configurar Dominio Personalizado (Opcional)

Si ITSQMET tiene dominio propio (ej: `dashboard.itsqmet.edu.ec`):

1. En Netlify, ve a **"Domain settings"**
2. Click **"Add custom domain"**
3. Escribe: `dashboard.itsqmet.edu.ec`
4. Netlify te dará registros DNS para configurar
5. Ve al proveedor de dominios de ITSQMET
6. Agrega estos registros:
   ```
   Type: CNAME
   Name: dashboard
   Value: usegbe-dashboard.netlify.app
   ```
7. Espera 24-48 horas (propagación DNS)
8. ✅ Netlify configurará SSL automáticamente

---

## 🔧 PASO 5: Configuraciones Adicionales

### **Variables de Entorno (si las necesitas)**

1. Ve a **"Site settings"** → **"Environment variables"**
2. Click **"Add a variable"**
3. Agrega tus variables:
   ```
   API_URL=https://api.itsqmet.edu.ec
   ```

### **Notificaciones de Deploy**

1. Ve a **"Site settings"** → **"Build & deploy"** → **"Deploy notifications"**
2. Configura notificaciones por:
   - Email
   - Slack
   - Webhook

---

## 📊 PASO 6: Monitoreo y Analytics

### **Ver estadísticas:**
1. En el dashboard, click en **"Analytics"**
2. Verás:
   - Visitas
   - Páginas más vistas
   - Ancho de banda usado
   - Tiempo de carga

### **Logs de deploy:**
1. Click en cualquier deploy
2. Ve a **"Deploy log"**
3. Revisa si hay errores

---

## 🆘 Solución de Problemas

### **Problema: "Page not found" al refrescar**
✅ **Solución:** El archivo `netlify.toml` ya está configurado con redirects

### **Problema: El sitio no carga**
✅ **Revisar:**
1. Directorio de publicación: `dist/dashboards-USEGBE/browser`
2. Build command: `npm run build`
3. Ver logs de deploy para errores

### **Problema: Imágenes no cargan**
✅ **Revisar:**
1. Las imágenes deben estar en `/public/images/`
2. Rutas absolutas: `/images/itsqmet.jpg`

### **Problema: 404 en rutas**
✅ **Solución:** Verifica que `netlify.toml` esté en la raíz del proyecto

---

## 📱 Compartir tu Sitio

### **URL para compartir:**
```
https://usegbe-dashboard.netlify.app
```

### **Código QR:**
1. Ve a: https://www.qr-code-generator.com
2. Pega tu URL de Netlify
3. Descarga el QR
4. ✅ Úsalo en presentaciones

---

## 🔄 Actualizar el Sitio

### **Si usaste Drag & Drop:**
1. Haz cambios en tu código local
2. Run: `ng build --configuration production`
3. Ve a Netlify → **"Deploys"**
4. Arrastra la nueva carpeta `dist/dashboards-USEGBE/browser`

### **Si usaste GitHub:**
1. Haz cambios en tu código local
2. Run:
   ```bash
   git add .
   git commit -m "Actualización: [descripción]"
   git push
   ```
3. ✅ Netlify desplegará automáticamente (2-3 min)

---

## 💰 Límites del Plan Gratuito

| Recurso | Límite Gratuito |
|---------|-----------------|
| **Ancho de banda** | 100 GB/mes |
| **Build minutes** | 300 minutos/mes |
| **Sitios** | Ilimitados |
| **Miembros del equipo** | 1 |
| **Deploy** | Ilimitados |

**Para un dashboard institucional, el plan gratuito es MÁS QUE SUFICIENTE** ✅

---

## 📞 Soporte

### **Documentación oficial:**
- https://docs.netlify.com

### **Community:**
- https://answers.netlify.com

### **Status:**
- https://www.netlifystatus.com

---

## ✅ Checklist Final

Antes de compartir con ITSQMET, verifica:

- [ ] Sitio carga correctamente
- [ ] Todas las funcionalidades funcionan
- [ ] Logo de ITSQMET se ve bien
- [ ] PDFs se generan correctamente
- [ ] Exportación a Excel/CSV/JSON funciona
- [ ] Gráficos se ven bien
- [ ] Colores institucionales correctos
- [ ] Responsive (prueba en móvil)
- [ ] Nombre del sitio es profesional
- [ ] Sin errores en consola del navegador

---

## 🎉 ¡Felicidades!

Tu Dashboard USEGBE está ahora en línea y accesible desde cualquier lugar del mundo.

**Próximos pasos sugeridos:**
1. Compartir URL con supervisores de ITSQMET
2. Recopilar feedback
3. Iterar y mejorar
4. Considerar dominio personalizado si aprueban
5. Documentar para futuros mantenedores

---

**Desarrollado para:** ITSQMET - USEGBE  
**Tecnología:** Angular + Netlify  
**Deploy Date:** Agosto 2026  
**Versión:** 2.0.0
