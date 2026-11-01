let paginaActual = 0;

function abrirLibro() {

    document.getElementById("introLibro")
        .classList.add("abierto");

    actualizarPaginas();

}


function moverPagina(direccion) {

    const paginas =
        document.querySelectorAll(".pagina-libro");

    paginaActual = Math.max(
        0,
        Math.min(
            paginas.length - 1,
            paginaActual + direccion
        )
    );

    actualizarPaginas();

}


function actualizarPaginas() {

    const paginas =
        document.querySelectorAll(".pagina-libro");

    paginas.forEach((pagina, indice) => {

        pagina.classList.toggle(
            "activa",
            indice === paginaActual
        );

    });

    document.getElementById("contadorPaginas").textContent =
        "Página " + (paginaActual + 1) +
        " de " + paginas.length;

    document.getElementById("paginaAnterior").disabled =
        paginaActual === 0;

    document.getElementById("paginaSiguiente").disabled =
        paginaActual === paginas.length - 1;

}


function entrarFamilia() {

    document.getElementById("introLibro")
        .classList.add("oculto");

}


/* ===================================
   FIREBASE · SINCRONIZACIÓN SWAN
=================================== */
const firebaseConfig = {
  apiKey: "AIzaSyDFZMxB9rI08hmwEPU8-1CncfwXesOBXTQ",
  authDomain: "family-swan.firebaseapp.com",
  projectId: "family-swan",
  storageBucket: "family-swan.firebasestorage.app",
  messagingSenderId: "61424439986",
  appId: "1:61424439986:web:bab5cea43097e9e936efab"
};
const UID_CREADOR_SWAN = "yrCtVpgbFYecc6ZlO5WkG3TpTNu2";
let authSWAN = null;
let dbSWAN = null;
let usuarioFirebaseSWAN = null;
let sincronizacionActivaSWAN = false;
let temporizadoresGuardadoSWAN = {};
let suscripcionesSWAN = [];
try {
  if (window.firebase && !firebase.apps.length) firebase.initializeApp(firebaseConfig);
  if (window.firebase) { authSWAN = firebase.auth(); dbSWAN = firebase.firestore(); }
} catch (error) { console.error("No se pudo iniciar Firebase:", error); }
function programarGuardadoNubeSWAN(tipo, datos) {
  if (!sincronizacionActivaSWAN || !dbSWAN || !usuarioFirebaseSWAN || usuarioFirebaseSWAN.uid !== UID_CREADOR_SWAN) return;
  clearTimeout(temporizadoresGuardadoSWAN[tipo]);
  temporizadoresGuardadoSWAN[tipo] = setTimeout(async () => {
    try {
      await dbSWAN.collection("familySwan").doc(tipo).set({ datos, actualizado: firebase.firestore.FieldValue.serverTimestamp() });
    } catch (error) {
      console.error("Error al sincronizar " + tipo, error);
      alert("No se pudo sincronizar con la nube. Revisa tu conexión y las reglas de Firestore.");
    }
  }, 500);
}
async function cargarDatosNubeSWAN() {
  if (!dbSWAN || !usuarioFirebaseSWAN || usuarioFirebaseSWAN.uid !== UID_CREADOR_SWAN) return;
  sincronizacionActivaSWAN = false;
  try {
    // Las fotos se dejan localmente en esta primera fase; se migrarán a Firebase Storage después.
    const tipos = ["integrantes", "eventos"];
    const resultados = await Promise.all(tipos.map(tipo => dbSWAN.collection("familySwan").doc(tipo).get()));
    const datosLocales = {
      integrantes: JSON.parse(localStorage.getItem("familySwanIntegrantes_v1") || "null"),
      eventos: JSON.parse(localStorage.getItem("familySwanEventos_v1") || "null"),
    };
    for (let i=0; i<tipos.length; i++) {
      const tipo=tipos[i], doc=resultados[i];
      if (doc.exists && doc.data() && doc.data().datos !== undefined) {
        const valor=doc.data().datos;
        if (tipo === "integrantes" && Array.isArray(valor)) integrantes=valor;
        if (tipo === "eventos" && valor && typeof valor === "object") eventos=valor;
        localStorage.setItem(tipo === "integrantes" ? "familySwanIntegrantes_v1" : "familySwanEventos_v1", JSON.stringify(valor));
      } else if (datosLocales[tipo] !== null) {
        await dbSWAN.collection("familySwan").doc(tipo).set({datos: datosLocales[tipo], actualizado: firebase.firestore.FieldValue.serverTimestamp()});
      } else {
        const inicial = tipo === "integrantes" ? integrantes : eventos;
        await dbSWAN.collection("familySwan").doc(tipo).set({datos: inicial, actualizado: firebase.firestore.FieldValue.serverTimestamp()});
      }
    }
    integrantes.forEach(persona => { const r=relacionesInicialesSWAN[persona.nombre]; if(r){if(!persona.padres)persona.padres=r.padres||"";if(!persona.pareja)persona.pareja=r.pareja||"";} });
    cargarIntegrantes(); cargarArbol(); cargarGaleria(); mostrarCalendario(); cargarListaAdminEventos();
    sincronizacionActivaSWAN = true;
    suscripcionesSWAN.forEach(unsub=>unsub()); suscripcionesSWAN=[];
    ["integrantes","eventos"].forEach(tipo=>{
      const unsub=dbSWAN.collection("familySwan").doc(tipo).onSnapshot(snapshot=>{
        if(!snapshot.exists || !snapshot.data())return;
        const valor=snapshot.data().datos;
        if(tipo==="integrantes" && Array.isArray(valor)){integrantes=valor;localStorage.setItem("familySwanIntegrantes_v1",JSON.stringify(valor));cargarIntegrantes();cargarArbol();}
        if(tipo==="eventos" && valor && typeof valor==="object"){eventos=valor;localStorage.setItem("familySwanEventos_v1",JSON.stringify(valor));mostrarCalendario();}
      }, error=>console.error("Error escuchando cambios de " + tipo,error));
      suscripcionesSWAN.push(unsub);
    });
  } catch(error) { console.error("Error cargando datos de FAMILY SWAN:",error); alert("No se pudieron cargar los datos compartidos. Comprueba que las reglas de Firestore estén publicadas."); }
}

/* ===================================
   CALENDARIO
=================================== */

let fecha = new Date();
let mes = fecha.getMonth();
let anio = fecha.getFullYear();
const nombresMeses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const STORAGE_EVENTOS_SWAN = "familySwanEventos_v1";
let eventos = {};
try { eventos = JSON.parse(localStorage.getItem(STORAGE_EVENTOS_SWAN) || "{}"); } catch (error) { eventos = {}; }

function guardarEventos() {
    try { localStorage.setItem(STORAGE_EVENTOS_SWAN, JSON.stringify(eventos)); programarGuardadoNubeSWAN("eventos", eventos); }
    catch (error) { alert("No se pudieron guardar los eventos en este navegador."); }
}
function fechaClaveLocal(fechaObj) {
    return fechaObj.getFullYear()+"-"+String(fechaObj.getMonth()+1).padStart(2,"0")+"-"+String(fechaObj.getDate()).padStart(2,"0");
}
function obtenerCumpleanos(persona) {
    const texto = String(persona.cumpleanos || "").trim().toLocaleLowerCase("es");
    if (!texto) return null;
    const meses = {enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12};
    let m = texto.match(/(\d{1,2})\s*(?:de\s*)?([a-záéíóú]+)/i);
    if (m && meses[m[2].normalize("NFD").replace(/[\u0300-\u036f]/g,"")]) {
        return {dia:Number(m[1]), mes:meses[m[2].normalize("NFD").replace(/[\u0300-\u036f]/g,"")]-1};
    }
    m = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return {dia:Number(m[3]), mes:Number(m[2])-1};
    m = texto.match(/^(\d{1,2})[/-](\d{1,2})$/);
    if (m) return {dia:Number(m[1]), mes:Number(m[2])-1};
    return null;
}
function colorFavoritoHex(valor) {
    const texto=String(valor||"").toLocaleLowerCase("es");
    if(/^#[0-9a-f]{6}$/i.test(texto)) return texto;
    const colores=[
        [/púrpura|purpura|morado|violeta/,"#8e5bb7"], [/azul/,"#3978c8"], [/verde fosforescente|neón|neon/,"#72d63b"], [/verde/,"#4b9b63"],
        [/rosa|rosado/,"#e78ab5"], [/rojo|roja/,"#d94b4b"], [/amarillo/,"#e6c344"], [/naranja|anaranjado/,"#e58a3a"],
        [/negro/,"#444047"], [/blanco/,"#e9e5dc"], [/café|cafe|marrón|marron/,"#986642"], [/gris|plateado/,"#929292"]
    ];
    const encontrado=colores.find(([exp])=>exp.test(texto));
    return encontrado?encontrado[1]:"#b58a62";
}

function obtenerEventosFecha(clave) {
    const propios = Array.isArray(eventos[clave]) ? eventos[clave] : [];
    const [year, month, day] = clave.split("-").map(Number);
    const cumpleanos = (typeof integrantes !== "undefined" ? integrantes : []).filter(p => {
        const cumple = obtenerCumpleanos(p);
        return cumple && cumple.dia === day && cumple.mes === month-1;
    }).map(p => ({nombre:"Cumpleaños de " + p.nombre, descripcion:"¡Hoy celebramos el cumpleaños de " + p.nombre + "!", tipo:"cumple", automatico:true, color:colorFavoritoHex(p.colorFavorito)}));
    return [...cumpleanos, ...propios];
}
function mostrarCalendario() {
    const primerDia = new Date(anio,mes,1).getDay();
    const cantidadDias = new Date(anio,mes+1,0).getDate();
    document.getElementById("mesActual").textContent = nombresMeses[mes] + " " + anio;
    const calendario = document.getElementById("diasCalendario");
    calendario.innerHTML = "";
    for(let i=0;i<primerDia;i++) { const espacio=document.createElement("div"); espacio.className="dia vacio"; calendario.appendChild(espacio); }
    for(let dia=1;dia<=cantidadDias;dia++) {
        const casilla=document.createElement("button"); casilla.type="button"; casilla.className="dia";
        const numero=document.createElement("span"); numero.textContent=dia; casilla.appendChild(numero);
        const fechaClave=anio+"-"+String(mes+1).padStart(2,"0")+"-"+String(dia).padStart(2,"0");
        if(dia===fecha.getDate() && mes===fecha.getMonth() && anio===fecha.getFullYear()) casilla.classList.add("hoy");
        const acontecimientos=obtenerEventosFecha(fechaClave);
        if(acontecimientos.length) {
            casilla.classList.add("tiene-evento");
            const marcadores=document.createElement("div"); marcadores.className="marcadores";
            acontecimientos.forEach(ev=>{ const punto=document.createElement("i"); punto.className="punto "+(ev.tipo==="cumple"?"cumple":"reunion"); if(ev.color)punto.style.backgroundColor=ev.color; marcadores.appendChild(punto); });
            casilla.appendChild(marcadores);
        }
        casilla.onclick=()=>mostrarEventos(fechaClave,dia);
        calendario.appendChild(casilla);
    }
}
function cambiarMes(cantidad) {
    mes+=cantidad; if(mes>11){mes=0;anio++;} if(mes<0){mes=11;anio--;}
    mostrarCalendario();
    document.getElementById("listaEventos").textContent="Selecciona una fecha para ver sus acontecimientos.";
    document.getElementById("tituloEventos").textContent="Eventos del mes";
}
function mostrarEventos(fechaClave,dia) {
    const lista=document.getElementById("listaEventos");
    document.getElementById("tituloEventos").textContent="Eventos del "+dia+" de "+nombresMeses[mes];
    lista.innerHTML="";
    const acontecimientos=obtenerEventosFecha(fechaClave);
    if(!acontecimientos.length){lista.textContent="No hay acontecimientos para esta fecha.";return;}
    acontecimientos.forEach(ev=>{
        const elemento=document.createElement("div"); elemento.className="evento";
        const etiqueta=document.createElement("strong");
        etiqueta.textContent=ev.tipo==="cumple"?"🎂 Cumpleaños":(ev.tipo==="importante"?"✦ Fecha importante":"🤎 Reunión");
        const nombre=document.createElement("div"); nombre.textContent=ev.nombre;
        if(ev.color) elemento.style.setProperty("--color-evento", ev.color);
        elemento.append(etiqueta,nombre);
        if(ev.descripcion){const descripcion=document.createElement("p");descripcion.textContent=ev.descripcion;elemento.appendChild(descripcion);}
        lista.appendChild(elemento);
    });
}
function guardarEventoAdmin(event) {
    event.preventDefault();
    const clave=document.getElementById("eventoFecha").value;
    if(!clave)return;
    const nuevo={id:Date.now().toString(),nombre:document.getElementById("eventoNombre").value.trim(),tipo:document.getElementById("eventoTipo").value,descripcion:document.getElementById("eventoDescripcion").value.trim(),color:document.getElementById("eventoColor").value};
    if(!nuevo.nombre || !nuevo.descripcion)return;
    if(!Array.isArray(eventos[clave]))eventos[clave]=[];
    eventos[clave].push(nuevo); guardarEventos(); document.getElementById("formEventoAdmin").reset();
    cargarListaAdminEventos(); mostrarCalendario();
    const [y,m,d]=clave.split("-").map(Number);
    if(y===anio && m-1===mes)mostrarEventos(clave,d);
    alert("Fecha guardada en el calendario.");
}
function cargarListaAdminEventos() {
    const lista=document.getElementById("listaAdminEventos"); if(!lista)return; lista.innerHTML="";
    Object.keys(eventos).sort().forEach(clave=>(eventos[clave]||[]).forEach((ev,indice)=>{
        const fila=document.createElement("div");fila.className="evento-admin-fila";
        const texto=document.createElement("span");texto.textContent=clave+" · "+ev.nombre;
        const eliminar=document.createElement("button");eliminar.type="button";eliminar.textContent="Eliminar";
        eliminar.onclick=()=>{if(!confirm("¿Eliminar esta fecha del calendario?"))return;eventos[clave].splice(indice,1);if(!eventos[clave].length)delete eventos[clave];guardarEventos();cargarListaAdminEventos();mostrarCalendario();};
        fila.append(texto,eliminar);lista.appendChild(fila);
    }));
}
function actualizarEstadoCampanita() {
    const boton = document.getElementById("campanitaNotificaciones");
    const estado = document.getElementById("estadoCampanita");
    if (!boton || !estado) return;
    const activada = "Notification" in window && Notification.permission === "granted" && localStorage.getItem("familySwanNotificaciones") === "si";
    boton.classList.toggle("activada", activada);
    boton.title = activada ? "Notificaciones activadas" : "Activar notificaciones";
    boton.setAttribute("aria-label", boton.title);
}
function activarNotificaciones() {
    if (!("Notification" in window)) { alert("Este navegador no permite notificaciones."); return; }
    if (Notification.permission === "denied") { alert("Las notificaciones están bloqueadas en el navegador. Puedes permitirlas desde los ajustes del sitio."); return; }
    Notification.requestPermission().then(permiso => {
        if (permiso === "granted") {
            localStorage.setItem("familySwanNotificaciones", "si");
            actualizarEstadoCampanita();
            alert("¡Campanita activada! Recibirás avisos de cumpleaños y fechas importantes cuando FAMILY SWAN esté abierto.");
            revisarNotificacionesEventos();
        } else { alert("No se concedió el permiso para mostrar notificaciones."); actualizarEstadoCampanita(); }
    });
}
function revisarNotificacionesEventos() {
    actualizarEstadoCampanita();
    if (!("Notification" in window) || Notification.permission !== "granted" || localStorage.getItem("familySwanNotificaciones") !== "si") return;
    const hoy = fechaClaveLocal(new Date());
    const delDia = obtenerEventosFecha(hoy);
    if (!delDia.length) return;
    const llave = "familySwanAviso_" + hoy;
    if (localStorage.getItem(llave) === "si") return;
    new Notification("FAMILY SWAN · Hoy hay una fecha especial", { body: delDia.map(e => e.nombre).join(" · ") });
    localStorage.setItem(llave, "si");
}

/* ===================================
   INTEGRANTES DE LA FAMILIA
=================================== */

/*
  Para poner una fotografía escribe su archivo
  en la propiedad foto.

  Ejemplo: foto:"jover.jpg"
*/

let integrantes = [

    {
        nombre:"Jomer",
        relacion:"Abuelo · Primera generación",
        descripcion:"Es el abuelo y la raíz de esta familia.",
        edad:"19",
        nombreRoblox:"Jomer_SRF (ABALAM_DLM)",
        cumpleanos:"28 de marzo",
        colorFavorito:"Púrpura",
        animalFavorito:"Perros",
        foto:""
    },

    {
        nombre:"Eduardo",
        relacion:"Integrante de la familia",
        descripcion:"Forma parte de FAMILY SWAN.",
        edad:"26",
        padres:"No especificados",
        hijos:"No tiene",
        nombreRoblox:"lalorm00",
        cumpleanos:"23 de febrero",
        colorFavorito:"Verde fosforescente",
        animalFavorito:"Ave picozapato y perros",
        foto:""
    },

    {
        nombre:"Zack",
        relacion:"Novio de Jocelin",
        descripcion:"Es el novio de Jocelin.",
        edad:"18",
        nombreRoblox:"0xyzvt",
        cumpleanos:"17 de marzo",
        colorFavorito:"Azul y morado",
        animalFavorito:"Ninguno",
        foto:""
    },

    {
        nombre:"Lei",
        relacion:"Hijo de Jomer",
        descripcion:"Hijo de Jomer y padre de Zia.",
        foto:""
    },

    {
        nombre:"Jan",
        relacion:"Hija de Jomer",
        descripcion:"Hija de Jomer y madre de siete hijos.",
        foto:""
    },

    {
        nombre:"Zia",
        relacion:"Hija de Lei",
        descripcion:"Forma parte de la familia por la rama de Lei.",
        foto:""
    },

    {
        nombre:"Kiari (Valen)",
        relacion:"Hija de Jan",
        descripcion:"Esposa de Angel y madre de Alejandro y Kevin.",
        edad:"19",
        padres:"Jan",
        hijos:"Kevin y Alejandro",
        nombreRoblox:"Valentinaa_swan",
        cumpleanos:"5 de enero",
        colorFavorito:"Negro y rosa",
        animalFavorito:"Conejito",
        foto:""
    },

    {
        nombre:"Angel",
        relacion:"Esposo de Kiari",
        descripcion:"Esposo de Kiari y padre de Alejandro y Kevin.",
        foto:""
    },

    {
        nombre:"Alejandro",
        relacion:"Hijo de Kiari y Angel",
        descripcion:"Forma parte de la siguiente generación familiar.",
        foto:""
    },

    {
        nombre:"Kevin",
        relacion:"Hijo de Kiari y Angel",
        descripcion:"Forma parte de la siguiente generación familiar.",
        foto:""
    },

    {
        nombre:"Jocelin",
        relacion:"Hija de Jan",
        descripcion:"Madre de Cherry y novia de Zack.",
        edad:"19",
        padres:"Jan",
        hijos:"1",
        nombreRoblox:"yodelin1233",
        cumpleanos:"22 de agosto",
        colorFavorito:"Negro y morado",
        animalFavorito:"Todos",
        foto:"jocelin.jpg"
    },

    {
        nombre:"Cherry",
        relacion:"Hija de Jocelin",
        descripcion:"Esposa de Angel Suguro y madre de Dafne.",
        foto:""
    },

    {
        nombre:"Angel Suguro",
        relacion:"Esposo de Cherry",
        descripcion:"Esposo de Cherry y padre de Dafne.",
        foto:""
    },

    {
        nombre:"Yamileth (Dafne)",
        relacion:"Hija de Cherry y Angel Suguro",
        descripcion:"Forma parte de la siguiente generación familiar.",
        edad:"15",
        padres:"Cherry y Angel",
        nombreRoblox:"dafne",
        cumpleanos:"21 de diciembre",
        colorFavorito:"Morado",
        animalFavorito:"Gato",
        foto:""
    },

    {
        nombre:"Nat",
        relacion:"Hija de Jan",
        descripcion:"Hija de Jan.",
        foto:""
    },

    {
        nombre:"Ale",
        relacion:"Hijo de Jan",
        descripcion:"Padre de Yess y Nahomi.",
        foto:""
    },

    {
        nombre:"Yess",
        relacion:"Hija de Ale",
        descripcion:"Forma parte de la siguiente generación familiar.",
        foto:""
    },

    {
        nombre:"Nahomi",
        relacion:"Hija de Ale",
        descripcion:"Forma parte de la siguiente generación familiar.",
        foto:""
    },

    {
        nombre:"Nathan",
        relacion:"Hijo de Jan",
        descripcion:"Hijo de Jan.",
        foto:""
    },

    {
        nombre:"Lalo",
        relacion:"Hijo de Jan",
        descripcion:"Hijo de Jan.",
        foto:""
    },

    {
        nombre:"Juan",
        relacion:"Hijo de Jan",
        descripcion:"Padre de Amelia.",
        edad:"17",
        padres:"Jan (el otro progenitor no especificado)",
        hijos:"Amelia",
        nombreRoblox:"juancapa70",
        cumpleanos:"9 de abril",
        colorFavorito:"Azul y negro",
        animalFavorito:"Conejo y gato",
        foto:"juan.jpg"
    },

    {
        nombre:"Amelia",
        relacion:"Hija de Juan",
        descripcion:"Madre de Cele.",
        foto:""
    },

    {
        nombre:"Cele",
        relacion:"Hija de Amelia",
        descripcion:"Forma parte de la siguiente generación familiar.",
        foto:""
    }

];

// Relaciones iniciales del árbol. El editor puede cambiarlas después.
const relacionesInicialesSWAN = {
    "Lei": { padres: "Jomer" }, "Jan": { padres: "Jomer" },
    "Zia": { padres: "Lei" }, "Kiari (Valen)": { padres: "Jan", pareja: "Angel" },
    "Angel": { pareja: "Kiari (Valen)" }, "Alejandro": { padres: "Kiari (Valen), Angel" },
    "Kevin": { padres: "Kiari (Valen), Angel" }, "Jocelin": { padres: "Jan", pareja: "Zack" },
    "Zack": { pareja: "Jocelin" }, "Cherry": { padres: "Jocelin", pareja: "Angel Suguro" },
    "Angel Suguro": { pareja: "Cherry" }, "Yamileth (Dafne)": { padres: "Cherry, Angel Suguro" },
    "Nat": { padres: "Jan" }, "Ale": { padres: "Jan" }, "Yess": { padres: "Ale" },
    "Nahomi": { padres: "Ale" }, "Nathan": { padres: "Jan" }, "Lalo": { padres: "Jan" },
    "Juan": { padres: "Jan" }, "Amelia": { padres: "Juan" }, "Cele": { padres: "Amelia" }
};
integrantes.forEach(persona => {
    const relacion = relacionesInicialesSWAN[persona.nombre];
    if (relacion) {
        if (!persona.padres) persona.padres = relacion.padres || "";
        if (!persona.pareja) persona.pareja = relacion.pareja || "";
    }
});

// Los cambios del administrador se conservan en este navegador.
// Accesos locales: una contraseña para el creador y hasta cinco administradores.
const STORAGE_ROLES_SWAN = "familySwanRoles_v1";
let rolesSWAN = { creador: "SWAN2026", administradores: [] };
try {
    const rolesGuardados = JSON.parse(localStorage.getItem(STORAGE_ROLES_SWAN) || "null");
    if (rolesGuardados && typeof rolesGuardados.creador === "string" && Array.isArray(rolesGuardados.administradores)) rolesSWAN = rolesGuardados;
} catch (error) { console.warn("No se pudieron cargar los accesos SWAN.", error); }
function guardarRolesSWAN() {
    try { localStorage.setItem(STORAGE_ROLES_SWAN, JSON.stringify(rolesSWAN)); return true; }
    catch (error) { alert("No se pudieron guardar los accesos en este navegador."); return false; }
}
const STORAGE_INTEGRANTES_SWAN = "familySwanIntegrantes_v1";
try {
    const guardados = localStorage.getItem(STORAGE_INTEGRANTES_SWAN);
    if (guardados) {
        const datos = JSON.parse(guardados);
        if (Array.isArray(datos)) integrantes = datos;
    }
} catch (error) {
    console.warn("No se pudieron cargar los integrantes guardados.", error);
}
// Asegura que las relaciones iniciales también se apliquen a datos guardados de versiones anteriores.
integrantes.forEach(persona => {
    const relacion = relacionesInicialesSWAN[persona.nombre];
    if (relacion) {
        if (!persona.padres) persona.padres = relacion.padres || "";
        if (!persona.pareja) persona.pareja = relacion.pareja || "";
    }
});

function guardarIntegrantesEnNavegador() {
    try {
        localStorage.setItem(STORAGE_INTEGRANTES_SWAN, JSON.stringify(integrantes));
        programarGuardadoNubeSWAN("integrantes", integrantes);
    } catch (error) {
        alert("No se pudieron guardar los cambios en este navegador.");
    }
}

/* ===================================
   MOSTRAR INTEGRANTES
=================================== */

function cargarIntegrantes() {

    const contenedor =
        document.getElementById("integrantesGrid");

    contenedor.innerHTML = "";

    integrantes.forEach((persona,index)=>{

        const tarjeta = document.createElement("article");

        tarjeta.className = "integrante";

        const imagenContenedor =
            document.createElement("div");

        imagenContenedor.className = "integrante-imagen";

        const placeholder = document.createElement("div");

        placeholder.className = "placeholder";

        placeholder.textContent = "♡";

        imagenContenedor.appendChild(placeholder);

        if(persona.foto) {

            const imagen = document.createElement("img");

            imagen.src = persona.foto;

            imagen.alt = persona.nombre;

            imagen.onerror = function() {
                this.style.display = "none";
                placeholder.style.display = "flex";
            };

            placeholder.style.display = "none";

            imagenContenedor.appendChild(imagen);

        }

        const informacion = document.createElement("div");

        informacion.className = "integrante-info";

        const nombre = document.createElement("h3");

        nombre.textContent = persona.nombre;

        const relacion = document.createElement("p");

        relacion.textContent = persona.relacion;

        informacion.appendChild(nombre);

        informacion.appendChild(relacion);

        tarjeta.appendChild(imagenContenedor);

        tarjeta.appendChild(informacion);

        tarjeta.onclick = ()=>abrirIntegrante(index);

        contenedor.appendChild(tarjeta);

    });

}

function abrirIntegrante(index) {

    const persona = integrantes[index];

    document.getElementById("modalNombre").textContent =
        persona.nombre;

    document.getElementById("modalRelacion").textContent =
        persona.relacion;

    const detalles = [
        persona.descripcion,
        persona.edad ? "Edad: " + persona.edad : "",
        persona.padres ? "Papás: " + persona.padres : "",
        persona.hijos ? "Hijos: " + persona.hijos : "",
        persona.nombreRoblox ? "Nombre de Roblox: " + persona.nombreRoblox : "",
        persona.cumpleanos ? "Cumpleaños: " + persona.cumpleanos : "",
        persona.colorFavorito ? "Color favorito: " + persona.colorFavorito : "",
        persona.animalFavorito ? "Animal favorito: " + persona.animalFavorito : ""
    ].filter(Boolean).join("\n\n");

    document.getElementById("modalDescripcion").textContent = detalles;
    document.getElementById("modalDescripcion").style.whiteSpace = "pre-line";

    document.getElementById("modalIntegrante").style.display =
        "flex";

}


/* ===================================
   DATOS DEL ARBOL GENEALOGICO
=================================== */

function normalizarNombreArbol(nombre) {
    return String(nombre || "").trim().toLocaleLowerCase("es");
}

function construirArbolFamilia() {
    const nodos=integrantes.map(persona=>({nombre:persona.nombre,relacion:persona.relacion||"Integrante de la familia",foto:persona.foto||"",pareja:persona.pareja||"",hijos:[]}));
    const porNombre=new Map(nodos.map(n=>[normalizarNombreArbol(n.nombre),n]));
    // Convierte "Pareja de X" escrito en el campo Padres o pareja en una relación de pareja real.
    integrantes.forEach(persona=>{
        const texto=String(persona.padres||"").trim();
        const match=texto.match(/^pareja\s+de\s+(.+)$/i);
        if(match){persona.pareja=match[1].trim();persona.padres="";}
    });
    nodos.forEach(nodo=>{
        const original=integrantes.find(p=>normalizarNombreArbol(p.nombre)===normalizarNombreArbol(nodo.nombre));
        nodo.pareja=original?.pareja||nodo.pareja;
        if(nodo.pareja){
            const pareja=porNombre.get(normalizarNombreArbol(nodo.pareja));
            if(pareja && !pareja.pareja)pareja.pareja=nodo.nombre;
        }
        const padres=String(original?.padres||"").split(",").map(x=>x.trim()).filter(Boolean);
        padres.forEach(nombrePadre=>{
            const padre=porNombre.get(normalizarNombreArbol(nombrePadre));
            if(padre && padre!==nodo && !padre.hijos.includes(nodo))padre.hijos.push(nodo);
        });
    });
    const conPadres=new Set();
    integrantes.forEach(persona=>{if(String(persona.padres||"").trim())conPadres.add(normalizarNombreArbol(persona.nombre));});
    return nodos.filter(nodo=>!conPadres.has(normalizarNombreArbol(nodo.nombre)) && !nodos.some(otro=>normalizarNombreArbol(otro.pareja)===normalizarNombreArbol(nodo.nombre)));
}

/* ===================================
   RAMAS ABIERTAS
=================================== */

/*
  Al principio no hay ninguna rama abierta.
  Solo aparece JOMER.
*/

const ramasAbiertas = new Set();


/* ===================================
   CREAR TARJETA CIRCULAR
=================================== */

function crearTarjetaArbol(persona,esRaiz=false) {

    const boton = document.createElement("button");

    boton.className = "arbol-persona";

    if(esRaiz) {
        boton.classList.add("arbol-raiz");
    }

    boton.type = "button";

    const circulo = document.createElement("div");

    circulo.className = "arbol-foto";

    /*
      Primero busca la foto en los datos del árbol.
      Si no existe, la busca en los integrantes.
    */

    const integrante = integrantes.find(p =>
        p.nombre.toUpperCase() === persona.nombre.toUpperCase() ||
        p.nombre.toUpperCase().startsWith(persona.nombre.toUpperCase()) ||
        persona.nombre.toUpperCase().startsWith(p.nombre.toUpperCase())
    );

    const foto = persona.foto || (integrante ? integrante.foto : "");

    if(foto) {

        const imagen = document.createElement("img");

        imagen.src = foto;

        imagen.alt = persona.nombre;

        imagen.onerror = function() {

            circulo.innerHTML = "";

            const inicial = document.createElement("span");

            inicial.className = "arbol-inicial";

            inicial.textContent = persona.nombre.charAt(0);

            circulo.appendChild(inicial);

        };

        circulo.appendChild(imagen);

    } else {

        const inicial = document.createElement("span");

        inicial.className = "arbol-inicial";

        inicial.textContent = persona.nombre.charAt(0);

        circulo.appendChild(inicial);

    }

    const nombre = document.createElement("span");

    nombre.className = "arbol-nombre";

    nombre.textContent = persona.nombre;

    const relacion = document.createElement("span");

    relacion.className = "arbol-relacion";

    relacion.textContent = persona.relacion || "";

    boton.appendChild(circulo);

    boton.appendChild(nombre);

    boton.appendChild(relacion);

    if(persona.hijos && persona.hijos.length>0) {

        const indicador = document.createElement("span");

        indicador.className = "arbol-indicador";

        indicador.textContent =
            ramasAbiertas.has(persona.nombre)
            ? "▲ Ocultar rama"
            : "▼ Ver descendencia";

        boton.appendChild(indicador);

    }

    /* AL PRESIONAR SE ABRE O SE CIERRA LA RAMA */

    boton.onclick = function() {

        if(!persona.hijos || persona.hijos.length===0) {
            return;
        }

        if(ramasAbiertas.has(persona.nombre)) {

            ramasAbiertas.delete(persona.nombre);

            /* También cierra sus descendientes */

            function cerrarDescendientes(personas) {

                personas.forEach(hijo=>{

                    ramasAbiertas.delete(hijo.nombre);

                    if(hijo.hijos) {
                        cerrarDescendientes(hijo.hijos);
                    }

                });

            }

            cerrarDescendientes(persona.hijos);

        } else {

            ramasAbiertas.add(persona.nombre);

        }

        cargarArbol();

    };

    return boton;

}


/* ===================================
   CONSTRUIR RAMAS
=================================== */

function crearRamaArbol(persona,esRaiz=false) {

    const rama = document.createElement("div");
    rama.className = "arbol-rama";

    /*
      La pareja solo se muestra cuando se abre la descendencia.
      Mientras la rama está cerrada, aparece únicamente la persona.
    */
    const ramaAbierta = ramasAbiertas.has(persona.nombre);

    if(persona.pareja && ramaAbierta) {
        const parejaContenedor = document.createElement("div");
        parejaContenedor.className = "arbol-pareja-contenedor";
        parejaContenedor.appendChild(crearTarjetaArbol(persona,esRaiz));

        const datosPareja = integrantes.find(p =>
            p.nombre.toUpperCase() === persona.pareja.toUpperCase() ||
            p.nombre.toUpperCase().startsWith(persona.pareja.toUpperCase())
        );
        const pareja = {
            nombre: persona.pareja,
            relacion: datosPareja ? datosPareja.relacion : "Pareja de " + persona.nombre,
            foto: datosPareja ? datosPareja.foto : ""
        };
        const tarjetaPareja = crearTarjetaArbol(pareja,false);
        tarjetaPareja.classList.add("arbol-tarjeta-pareja");
        parejaContenedor.appendChild(tarjetaPareja);
        rama.appendChild(parejaContenedor);
    } else {
        rama.appendChild(crearTarjetaArbol(persona,esRaiz));
    }

    if(
        persona.hijos &&
        persona.hijos.length>0 &&
        ramasAbiertas.has(persona.nombre)
    ) {
        const contenedorHijos = document.createElement("div");
        contenedorHijos.className = "arbol-ramas";

        persona.hijos.forEach(hijo=>{
            const columna = document.createElement("div");
            columna.className = "arbol-rama-hijo";
            columna.appendChild(crearRamaArbol(hijo));
            contenedorHijos.appendChild(columna);
        });

        rama.appendChild(contenedorHijos);
    }

    return rama;
}


/* ===================================
   DIBUJAR ARBOL COMPLETO
=================================== */

function cargarArbol() {

    const contenedor =
        document.getElementById("arbolGenealogico");

    contenedor.innerHTML = "";

    const raices = construirArbolFamilia();
    if (!raices.length) {
        contenedor.textContent = "Agrega integrantes y asigna sus padres para construir el árbol.";
        return;
    }
    raices.forEach((raiz, indice) => {
        contenedor.appendChild(crearRamaArbol(raiz, indice === 0));
    });

}


/* ===================================
   GALERIA DE RECUERDOS
=================================== */

/*
  Coloca aquí los nombres de tus fotografías.
  Deben estar en la misma carpeta de index.html.
*/

const STORAGE_GALERIA_SWAN = "familySwanGaleria_v1";
let fotografias = [
    "recuerdo1.jpg", "recuerdo2.jpg", "recuerdo3.jpg", "recuerdo4.jpg",
    "recuerdo5.jpg", "recuerdo6.jpg", "recuerdo7.jpg", "recuerdo8.jpg"
];
try {
    const guardadas = localStorage.getItem(STORAGE_GALERIA_SWAN);
    if (guardadas) fotografias = JSON.parse(guardadas);
} catch (error) { console.warn("No se pudo cargar la galería guardada.", error); }

function guardarGaleria() {
    try { localStorage.setItem(STORAGE_GALERIA_SWAN, JSON.stringify(fotografias)); programarGuardadoNubeSWAN("galeria", fotografias); }
    catch (error) { alert("El almacenamiento del navegador está lleno. Prueba con imágenes más pequeñas."); }
}

function cargarGaleria() {
    const contenedor = document.getElementById("galeriaGrid");
    contenedor.innerHTML = "";
    fotografias.forEach((archivo, index) => {
        const tarjeta = document.createElement("div");
        tarjeta.className = "foto-galeria";
        const imagen = document.createElement("img");
        imagen.src = archivo;
        imagen.alt = "Recuerdo familiar " + (index + 1);
        const placeholder = document.createElement("div");
        placeholder.className = "placeholder";
        placeholder.textContent = "♡";
        imagen.onerror = function() { this.style.display = "none"; placeholder.style.display = "flex"; };
        tarjeta.append(imagen, placeholder);
        if (modoAdministrador) {
            const eliminar = document.createElement("button");
            eliminar.type = "button";
            eliminar.className = "eliminar-foto-admin";
            eliminar.textContent = "×";
            eliminar.title = "Eliminar recuerdo";
            eliminar.onclick = event => {
                event.stopPropagation();
                if (!confirm("¿Eliminar esta imagen de la galería?")) return;
                fotografias.splice(index, 1);
                guardarGaleria();
                cargarGaleria();
            };
            tarjeta.appendChild(eliminar);
        }
        tarjeta.onclick = function(event) {
            if (modoAdministrador && event.target.closest(".eliminar-foto-admin")) return;
            if (imagen.style.display === "none") return;
            document.getElementById("imagenAmpliada").src = archivo;
            document.getElementById("modalFoto").style.display = "flex";
        };
        contenedor.appendChild(tarjeta);
    });
}

function agregarImagenesGaleria(event) {
    const archivos = Array.from(event.target.files || []);
    if (!archivos.length) return;
    Promise.all(archivos.map(archivo => new Promise((resolve, reject) => {
        if (!archivo.type.startsWith("image/")) return resolve(null);
        const lector = new FileReader();
        lector.onload = () => {
            const img = new Image();
            img.onload = () => {
                const max = 1400;
                const escala = Math.min(1, max / Math.max(img.width, img.height));
                const canvas = document.createElement("canvas");
                canvas.width = Math.round(img.width * escala);
                canvas.height = Math.round(img.height * escala);
                canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL("image/jpeg", 0.82));
            };
            img.onerror = reject;
            img.src = lector.result;
        };
        lector.onerror = reject;
        lector.readAsDataURL(archivo);
    }))).then(imagenes => {
        fotografias.push(...imagenes.filter(Boolean));
        guardarGaleria();
        cargarGaleria();
        event.target.value = "";
    }).catch(() => alert("No se pudo cargar una de las imágenes. Inténtalo con otro archivo."));
}

/* ===================================
   CERRAR VENTANAS
=================================== */

function cerrarModales() {

    document.getElementById("modalIntegrante").style.display =
        "none";

    document.getElementById("modalFoto").style.display =
        "none";

}

function cerrarModalFondo(event) {

    if(event.target.id==="modalIntegrante") {
        cerrarModales();
    }

}


/* ===================================
   MODO ADMINISTRADOR DENTRO DE LA PÁGINA
=================================== */

let modoAdministrador = false;
let rolActualSWAN = "";

function abrirAccesoAdmin(event) {
    if (event) event.stopPropagation();
    document.getElementById("adminLogin").style.display = "flex";
    document.getElementById("codigoAdmin").value = "";
    document.getElementById("correoAdmin").value = "";
    document.getElementById("errorAdmin").textContent = "";
    setTimeout(() => document.getElementById("correoAdmin").focus(), 50);
}

async function comprobarCodigoAdmin(event) {
    event.preventDefault();
    const correo = document.getElementById("correoAdmin").value.trim();
    const clave = document.getElementById("codigoAdmin").value;
    const errorEl = document.getElementById("errorAdmin");
    if (!authSWAN || !dbSWAN) { errorEl.textContent = "Firebase no está disponible. Recarga la página e inténtalo de nuevo."; return; }
    try {
        const credencial = await authSWAN.signInWithEmailAndPassword(correo, clave);
        usuarioFirebaseSWAN = credencial.user;
        if (usuarioFirebaseSWAN.uid !== UID_CREADOR_SWAN) {
            await authSWAN.signOut(); usuarioFirebaseSWAN = null;
            errorEl.textContent = "Esta cuenta todavía no tiene permisos asignados en FAMILY SWAN.";
            return;
        }
        modoAdministrador = true;
        rolActualSWAN = "creador";
        document.getElementById("adminLogin").style.display = "none";
        entrarFamilia();
        document.getElementById("controlesIntegrantes").hidden = false;
        document.getElementById("controlesGaleria").hidden = false;
        document.getElementById("controlesEventos").hidden = false;
        document.getElementById("panelCreador").hidden = false;
        const saludo=document.getElementById("saludoAcceso");
        saludo.textContent = "BIENVENIDO, CREADOR"; saludo.hidden=false; saludo.classList.add("saludo-creador");
        await cargarDatosNubeSWAN();
        cargarListaAdministradores(); cargarListaAdminEventos(); cargarGaleria();
        window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
        console.error(error);
        errorEl.textContent = error.code === "auth/invalid-credential" || error.code === "auth/wrong-password" ? "Correo o contraseña incorrectos." : "No se pudo iniciar sesión. Revisa los datos e inténtalo de nuevo.";
    }
}

function cerrarAdmin() { document.getElementById("adminLogin").style.display = "none"; }
function cerrarAdminFondo(event) { if (event.target.classList.contains("admin-capa")) cerrarAdmin(); }

function cargarListaAdministradores() {
    const lista = document.getElementById("listaAdministradores");
    if (!lista) return;
    lista.innerHTML = "";
    if (!rolesSWAN.administradores.length) { lista.textContent = "Todavía no hay administradores agregados."; return; }
    rolesSWAN.administradores.forEach((admin, indice) => {
        const fila = document.createElement("div"); fila.className = "admin-usuario-fila";
        const nombre = document.createElement("span"); nombre.textContent = admin.nombre;
        const acciones = document.createElement("div");
        const editar = document.createElement("button"); editar.type = "button"; editar.textContent = "Cambiar contraseña";
        editar.onclick = () => {
            const nueva = prompt("Escribe la nueva contraseña para " + admin.nombre + " (mínimo 4 caracteres):");
            if (nueva === null) return;
            if (nueva.trim().length < 4) { alert("La contraseña debe tener al menos 4 caracteres."); return; }
            if (nueva.trim() === rolesSWAN.creador || rolesSWAN.administradores.some((a, i) => i !== indice && a.clave === nueva.trim())) { alert("Esa contraseña ya está en uso."); return; }
            rolesSWAN.administradores[indice].clave = nueva.trim(); guardarRolesSWAN(); alert("Contraseña actualizada.");
        };
        const eliminar = document.createElement("button"); eliminar.type = "button"; eliminar.textContent = "Eliminar";
        eliminar.onclick = () => { if (!confirm("¿Eliminar al administrador " + admin.nombre + "?")) return; rolesSWAN.administradores.splice(indice, 1); guardarRolesSWAN(); cargarListaAdministradores(); };
        acciones.append(editar, eliminar); fila.append(nombre, acciones); lista.appendChild(fila);
    });
}

function guardarAdministrador(event) {
    event.preventDefault();
    if (rolActualSWAN !== "creador") return;
    const nombre = document.getElementById("nuevoAdminNombre").value.trim();
    const clave = document.getElementById("nuevoAdminClave").value.trim();
    if (rolesSWAN.administradores.length >= 5) { alert("Ya alcanzaste el límite de 5 administradores."); return; }
    if (clave.length < 4) { alert("La contraseña debe tener al menos 4 caracteres."); return; }
    if (clave === rolesSWAN.creador || rolesSWAN.administradores.some(a => a.clave === clave)) { alert("Cada persona debe tener una contraseña diferente."); return; }
    rolesSWAN.administradores.push({ nombre, clave });
    if (!guardarRolesSWAN()) { rolesSWAN.administradores.pop(); return; }
    document.getElementById("formAdminCreador").reset(); cargarListaAdministradores();
    alert("Administrador agregado correctamente.");
}

function cambiarClaveCreador(event) {
    event.preventDefault();
    if (rolActualSWAN !== "creador") return;
    const nueva = document.getElementById("nuevaClaveCreador").value.trim();
    if (nueva.length < 4) { alert("La contraseña debe tener al menos 4 caracteres."); return; }
    if (rolesSWAN.administradores.some(a => a.clave === nueva)) { alert("Esa contraseña ya está en uso por un administrador."); return; }
    rolesSWAN.creador = nueva; guardarRolesSWAN(); document.getElementById("formClaveCreador").reset();
    alert("Tu contraseña de creador fue cambiada.");
}

function mostrarEditorIntegrantes() {
    const editor = document.getElementById("editorIntegrantes");
    editor.hidden = !editor.hidden;
    if (!editor.hidden) {
        cargarListaAdmin();
        editor.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}

function cerrarModoAdmin() {
    modoAdministrador = false;
    document.getElementById("controlesIntegrantes").hidden = true;
    document.getElementById("controlesGaleria").hidden = true;
    document.getElementById("controlesEventos").hidden = true;
    document.getElementById("panelCreador").hidden = true;
    document.getElementById("editorIntegrantes").hidden = true;
    rolActualSWAN = "";
    sincronizacionActivaSWAN = false;
    if (authSWAN && usuarioFirebaseSWAN) { authSWAN.signOut().catch(console.error); usuarioFirebaseSWAN = null; }
    cargarGaleria();
    cargarIntegrantes();
    cargarArbol();
}

function cargarListaAdmin() {
    const lista = document.getElementById("adminListaIntegrantes");
    lista.innerHTML = "";
    integrantes.forEach((persona, indice) => {
        const fila = document.createElement("div");
        fila.className = "admin-persona";
        const nombre = document.createElement("span");
        nombre.textContent = persona.nombre || "Sin nombre";
        const editar = document.createElement("button");
        editar.type = "button"; editar.textContent = "Editar";
        editar.onclick = () => editarIntegranteAdmin(indice);
        const eliminar = document.createElement("button");
        eliminar.type = "button"; eliminar.textContent = "Eliminar";
        eliminar.className = "admin-eliminar";
        eliminar.onclick = () => eliminarIntegranteAdmin(indice);
        fila.append(nombre, editar, eliminar);
        lista.appendChild(fila);
    });
}

function editarIntegranteAdmin(indice) {
    const persona = integrantes[indice];
    document.getElementById("adminIndice").value = indice;
    document.getElementById("adminFormularioTitulo").textContent = "Editar integrante";
    const campos = {
        adminNombre: "nombre", adminRelacion: "relacion", adminDescripcion: "descripcion",
        adminEdad: "edad", adminPadres: "padres", adminRoblox: "nombreRoblox",
        adminCumple: "cumpleanos", adminColor: "colorFavorito", adminAnimal: "animalFavorito", adminFoto: "foto"
    };
    Object.entries(campos).forEach(([id, propiedad]) => { document.getElementById(id).value = persona[propiedad] || ""; });
    if (persona.pareja) document.getElementById("adminPadres").value = "Pareja de " + persona.pareja;
    document.getElementById("formIntegranteAdmin").scrollIntoView({ behavior: "smooth", block: "start" });
}

function limpiarFormularioAdmin() {
    document.getElementById("formIntegranteAdmin").reset();
    document.getElementById("adminIndice").value = "";
    document.getElementById("adminFormularioTitulo").textContent = "Agregar integrante";
}

function guardarIntegranteAdmin(event) {
    event.preventDefault();
    const relacionTexto=document.getElementById("adminPadres").value.trim();
    const esPareja=/^pareja\s+de\s+/i.test(relacionTexto);
    const parejaNombre=esPareja?relacionTexto.replace(/^pareja\s+de\s+/i,"").trim():"";
    const padres=esPareja?"":relacionTexto;
    const persona={
        nombre:document.getElementById("adminNombre").value.trim(),
        relacion:document.getElementById("adminRelacion").value.trim(),
        descripcion:document.getElementById("adminDescripcion").value.trim(),
        edad:document.getElementById("adminEdad").value.trim(),
        padres:padres,
        pareja:parejaNombre,
        hijos:"",
        nombreRoblox:document.getElementById("adminRoblox").value.trim(),
        cumpleanos:document.getElementById("adminCumple").value.trim(),
        colorFavorito:document.getElementById("adminColor").value.trim(),
        animalFavorito:document.getElementById("adminAnimal").value.trim(),
        foto:document.getElementById("adminFoto").value.trim()
    };
    Object.keys(persona).forEach(key=>{if(!persona[key])delete persona[key];});
    const indice=document.getElementById("adminIndice").value;
    if(indice==="")integrantes.push(persona); else integrantes[Number(indice)]=persona;
    // Guarda también la relación en el otro integrante para que ambos aparezcan juntos.
    if(parejaNombre){
        const parejaExistente=integrantes.find(p=>normalizarNombreArbol(p.nombre)===normalizarNombreArbol(parejaNombre));
        if(parejaExistente)parejaExistente.pareja=persona.nombre;
    }
    guardarIntegrantesEnNavegador(); ramasAbiertas.clear(); cargarIntegrantes(); cargarListaAdmin(); cargarArbol(); limpiarFormularioAdmin();
    alert("Integrante guardado. El árbol genealógico se actualizó automáticamente.");
}

function eliminarIntegranteAdmin(indice) {
    const nombre = integrantes[indice].nombre || "este integrante";
    if (!confirm(`¿Seguro que quieres eliminar a ${nombre}? También dejará de aparecer en el árbol.`)) return;
    integrantes.splice(indice, 1);
    guardarIntegrantesEnNavegador();
    cargarIntegrantes();
    cargarListaAdmin();
    ramasAbiertas.clear();
    cargarArbol();
    limpiarFormularioAdmin();
}

/* ===================================
   INICIAR PAGINA
=================================== */

mostrarCalendario();
actualizarEstadoCampanita();
revisarNotificacionesEventos();
setInterval(revisarNotificacionesEventos, 60000);
cargarIntegrantes();

cargarArbol();

cargarGaleria();
